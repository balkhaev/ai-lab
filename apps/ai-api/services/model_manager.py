"""
Model Manager Service - Dynamic loading and unloading of models
"""
import asyncio
import gc
import logging
from datetime import datetime, timezone
from enum import Enum

import torch

from config import (
    TENSOR_PARALLEL_SIZE,
    GPU_MEMORY_UTILIZATION,
    MAX_MODEL_LEN,
    get_device,
    get_dtype,
)
from models.management import ModelType, ModelStatus, ModelInfo
from state import llm_engines, model_info, media_models, model_status

logger = logging.getLogger(__name__)


class VideoModelFamily(str, Enum):
    """Video model families with different pipeline requirements"""
    COGVIDEOX = "cogvideox"      # THUDM/CogVideoX-* models
    HUNYUAN = "hunyuan"          # tencent/HunyuanVideo
    WAN = "wan"                  # Wan-AI/Wan2.2-* models (official diffusers)
    WAN_RAPID = "wan_rapid"      # Phr00t/WAN2.2-14B-Rapid-AllInOne (FP8 accelerated)
    LTX = "ltx"                  # Lightricks/LTX-Video
    UNKNOWN = "unknown"


def detect_video_model_family(model_id: str) -> VideoModelFamily:
    """
    Detect the video model family based on model ID.
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        VideoModelFamily enum value
    """
    model_id_lower = model_id.lower()
    
    # CogVideoX models
    if "cogvideo" in model_id_lower or "thudm" in model_id_lower:
        return VideoModelFamily.COGVIDEOX
    
    # HunyuanVideo models
    if "hunyuan" in model_id_lower or "tencent" in model_id_lower:
        return VideoModelFamily.HUNYUAN
    
    # Phr00t Rapid models (check before generic Wan)
    if "rapid" in model_id_lower or "phr00t" in model_id_lower:
        return VideoModelFamily.WAN_RAPID
    
    # Wan models (including official Wan-AI and variants)
    if "wan" in model_id_lower:
        return VideoModelFamily.WAN
    
    # LTX-Video models
    if "ltx" in model_id_lower or "lightricks" in model_id_lower:
        return VideoModelFamily.LTX
    
    return VideoModelFamily.UNKNOWN


def get_disk_usage_info() -> tuple[float | None, float | None, float | None]:
    """Get disk usage info in GB for HuggingFace cache: (total, used, free)"""
    import os
    import shutil

    # Get HF cache directory
    hf_home = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))

    try:
        # Get disk usage for the partition containing HF cache
        usage = shutil.disk_usage(hf_home)
        total = usage.total / (1024 ** 3)  # GB
        used = usage.used / (1024 ** 3)
        free = usage.free / (1024 ** 3)
        return total, used, free
    except OSError:
        return None, None, None


def get_gpu_memory_info() -> tuple[float | None, float | None, float | None]:
    """Get GPU memory info in MB: (total, used, free)"""
    if not torch.cuda.is_available():
        return None, None, None

    try:
        # Try pynvml for accurate GPU memory (includes vLLM allocations)
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        pynvml.nvmlShutdown()

        total = mem_info.total / (1024 * 1024)
        used = mem_info.used / (1024 * 1024)
        free = mem_info.free / (1024 * 1024)

        return total, used, free
    except ImportError:
        # Fallback to torch - use reserved memory as it's closer to nvidia-smi "used"
        # Note: This may underreport vLLM memory which allocates outside PyTorch
        total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
        # Use reserved (not allocated) - reserved includes caching allocator buffers
        # and is closer to what nvidia-smi/pynvml reports as "used"
        used = torch.cuda.memory_reserved(0) / (1024 * 1024)
        free = total - used

        return total, used, free


def estimate_model_memory() -> float | None:
    """Estimate current GPU memory used by models"""
    if not torch.cuda.is_available():
        return None
    return torch.cuda.memory_allocated(0) / (1024 * 1024)


def _get_model_short_name(model_id: str) -> str:
    """Extract short name from model ID"""
    return model_id.split("/")[-1]


async def load_llm_model(model_id: str) -> bool:
    """Load LLM model using vLLM"""
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.engine.async_llm_engine import AsyncLLMEngine

    logger.info(f"Loading LLM model: {model_id}")

    model_status[model_id] = {
        "type": ModelType.LLM,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        engine_args = AsyncEngineArgs(
            model=model_id,
            tensor_parallel_size=TENSOR_PARALLEL_SIZE,
            gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
            max_model_len=MAX_MODEL_LEN,
            trust_remote_code=True,
            dtype="auto",
        )

        engine = AsyncLLMEngine.from_engine_args(engine_args)
        llm_engines[model_id] = engine

        model_info[model_id] = {
            "name": _get_model_short_name(model_id),
            "size": 0,
            "loaded": True,
        }

        model_status[model_id] = {
            "type": ModelType.LLM,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"LLM model {model_id} loaded successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to load LLM model {model_id}: {e}")
        model_status[model_id] = {
            "type": ModelType.LLM,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False


async def unload_llm_model(model_id: str) -> tuple[bool, float | None]:
    """Unload LLM model and free GPU memory"""
    logger.info(f"Unloading LLM model: {model_id}")

    if model_id not in llm_engines:
        logger.warning(f"LLM model {model_id} is not loaded")
        return False, None

    model_status[model_id] = {
        "type": ModelType.LLM,
        "status": ModelStatus.UNLOADING,
        "error": None,
        "loaded_at": None,
    }

    memory_before = estimate_model_memory()

    try:
        engine = llm_engines[model_id]

        # Shutdown the vLLM engine
        if hasattr(engine, "shutdown"):
            await engine.shutdown()
        elif hasattr(engine, "_abort_all"):
            await engine._abort_all()

        # Remove references
        del llm_engines[model_id]
        if model_id in model_info:
            del model_info[model_id]

        # Force garbage collection and clear CUDA cache
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()

        memory_after = estimate_model_memory()
        freed_memory = None
        if memory_before is not None and memory_after is not None:
            freed_memory = memory_before - memory_after

        model_status[model_id] = {
            "type": ModelType.LLM,
            "status": ModelStatus.NOT_LOADED,
            "error": None,
            "loaded_at": None,
        }

        logger.info(f"LLM model {model_id} unloaded successfully, freed ~{freed_memory:.0f}MB" if freed_memory else f"LLM model {model_id} unloaded")
        return True, freed_memory

    except Exception as e:
        logger.error(f"Failed to unload LLM model {model_id}: {e}")
        model_status[model_id] = {
            "type": ModelType.LLM,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False, None


def load_image_model_sync(model_id: str) -> bool:
    """Load image generation model"""
    from diffusers import DiffusionPipeline

    logger.info(f"Loading image model: {model_id}")

    model_status[model_id] = {
        "type": ModelType.IMAGE,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        pipe = DiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=get_dtype(),
            trust_remote_code=True,
        )
        pipe.to(get_device())
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()

        media_models["image"] = pipe
        media_models["image_model_id"] = model_id

        model_status[model_id] = {
            "type": ModelType.IMAGE,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Image model {model_id} loaded successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to load image model {model_id}: {e}")
        model_status[model_id] = {
            "type": ModelType.IMAGE,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False


async def load_image_model(model_id: str) -> bool:
    """Load image generation model (async wrapper)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, load_image_model_sync, model_id)


def unload_image_model_sync(model_id: str) -> tuple[bool, float | None]:
    """Unload image model and free GPU memory"""
    logger.info(f"Unloading image model: {model_id}")

    if "image" not in media_models:
        logger.warning("No image model is loaded")
        return False, None

    current_model_id = media_models.get("image_model_id", model_id)

    model_status[current_model_id] = {
        "type": ModelType.IMAGE,
        "status": ModelStatus.UNLOADING,
        "error": None,
        "loaded_at": None,
    }

    memory_before = estimate_model_memory()

    try:
        pipe = media_models["image"]

        # Move model to CPU first to free GPU memory
        if hasattr(pipe, "to"):
            pipe.to("cpu")

        # Delete pipeline
        del media_models["image"]
        if "image_model_id" in media_models:
            del media_models["image_model_id"]

        # Force garbage collection
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()

        memory_after = estimate_model_memory()
        freed_memory = None
        if memory_before is not None and memory_after is not None:
            freed_memory = memory_before - memory_after

        model_status[current_model_id] = {
            "type": ModelType.IMAGE,
            "status": ModelStatus.NOT_LOADED,
            "error": None,
            "loaded_at": None,
        }

        logger.info(f"Image model unloaded successfully, freed ~{freed_memory:.0f}MB" if freed_memory else "Image model unloaded")
        return True, freed_memory

    except Exception as e:
        logger.error(f"Failed to unload image model: {e}")
        model_status[current_model_id] = {
            "type": ModelType.IMAGE,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False, None


async def unload_image_model(model_id: str) -> tuple[bool, float | None]:
    """Unload image model (async wrapper)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, unload_image_model_sync, model_id)


def load_image2image_model_sync(model_id: str) -> bool:
    """Load image-to-image generation model"""
    from diffusers import AutoPipelineForImage2Image

    logger.info(f"Loading image2image model: {model_id}")

    model_status[model_id] = {
        "type": ModelType.IMAGE2IMAGE,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        pipe = AutoPipelineForImage2Image.from_pretrained(
            model_id,
            torch_dtype=get_dtype(),
            use_safetensors=True,
        )
        pipe.to(get_device())
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()

        media_models["image2image"] = pipe
        media_models["image2image_model_id"] = model_id

        model_status[model_id] = {
            "type": ModelType.IMAGE2IMAGE,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Image2image model {model_id} loaded successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to load image2image model {model_id}: {e}")
        model_status[model_id] = {
            "type": ModelType.IMAGE2IMAGE,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False


async def load_image2image_model(model_id: str) -> bool:
    """Load image2image generation model (async wrapper)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, load_image2image_model_sync, model_id)


def unload_image2image_model_sync(model_id: str) -> tuple[bool, float | None]:
    """Unload image2image model and free GPU memory"""
    logger.info(f"Unloading image2image model: {model_id}")

    if "image2image" not in media_models:
        logger.warning("No image2image model is loaded")
        return False, None

    current_model_id = media_models.get("image2image_model_id", model_id)

    model_status[current_model_id] = {
        "type": ModelType.IMAGE2IMAGE,
        "status": ModelStatus.UNLOADING,
        "error": None,
        "loaded_at": None,
    }

    memory_before = estimate_model_memory()

    try:
        pipe = media_models["image2image"]

        # Move model to CPU first to free GPU memory
        if hasattr(pipe, "to"):
            pipe.to("cpu")

        # Delete pipeline
        del media_models["image2image"]
        if "image2image_model_id" in media_models:
            del media_models["image2image_model_id"]

        # Force garbage collection
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()

        memory_after = estimate_model_memory()
        freed_memory = None
        if memory_before is not None and memory_after is not None:
            freed_memory = memory_before - memory_after

        model_status[current_model_id] = {
            "type": ModelType.IMAGE2IMAGE,
            "status": ModelStatus.NOT_LOADED,
            "error": None,
            "loaded_at": None,
        }

        logger.info(f"Image2image model unloaded successfully, freed ~{freed_memory:.0f}MB" if freed_memory else "Image2image model unloaded")
        return True, freed_memory

    except Exception as e:
        logger.error(f"Failed to unload image2image model: {e}")
        model_status[current_model_id] = {
            "type": ModelType.IMAGE2IMAGE,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False, None


async def unload_image2image_model(model_id: str) -> tuple[bool, float | None]:
    """Unload image2image model (async wrapper)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, unload_image2image_model_sync, model_id)


def _load_cogvideox_pipeline(model_id: str):
    """Load CogVideoX pipeline"""
    from diffusers import CogVideoXImageToVideoPipeline
    
    pipe = CogVideoXImageToVideoPipeline.from_pretrained(
        model_id,
        torch_dtype=get_dtype(),
    )
    return pipe


def _load_hunyuan_pipeline(model_id: str):
    """Load HunyuanVideo pipeline"""
    from diffusers import HunyuanVideoPipeline
    
    pipe = HunyuanVideoPipeline.from_pretrained(
        model_id,
        torch_dtype=get_dtype(),
    )
    return pipe


def _load_wan_pipeline(model_id: str):
    """Load Wan video pipeline (supports both T2V and I2V)"""
    from diffusers import WanImageToVideoPipeline, AutoencoderKLWan
    
    # Load VAE separately for better quality
    vae = AutoencoderKLWan.from_pretrained(
        model_id,
        subfolder="vae",
        torch_dtype=torch.float32,  # VAE needs higher precision
    )
    
    pipe = WanImageToVideoPipeline.from_pretrained(
        model_id,
        vae=vae,
        torch_dtype=get_dtype(),
    )
    return pipe


def _load_ltx_pipeline(model_id: str):
    """Load LTX-Video pipeline"""
    from diffusers import LTXImageToVideoPipeline
    
    pipe = LTXImageToVideoPipeline.from_pretrained(
        model_id,
        torch_dtype=get_dtype(),
    )
    return pipe


def _load_wan_rapid_pipeline(model_id: str):
    """
    Load Phr00t/WAN2.2-14B-Rapid-AllInOne model.
    
    This is a FP8 accelerated "all-in-one" model that supports T2V, I2V, and VACE.
    Optimized for: 4 steps, CFG 1, euler_a/beta sampler.
    Works on 8GB+ VRAM.
    
    Note: This model is a ComfyUI checkpoint, we try to load it via diffusers.
    """
    from huggingface_hub import hf_hub_download
    from diffusers import WanImageToVideoPipeline
    
    logger.info(f"Loading Wan Rapid model from {model_id}")
    
    # Try to find the latest MEGA safetensors file
    try:
        # Try loading as standard Wan model first (in case structure is compatible)
        pipe = WanImageToVideoPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float8_e4m3fn if torch.cuda.is_available() else get_dtype(),
            trust_remote_code=True,
        )
        return pipe
    except Exception as e:
        logger.warning(f"Could not load as standard pipeline: {e}")
        
        # Fallback: Download specific checkpoint and load via from_single_file
        try:
            # Try to download MEGA checkpoint
            checkpoint_path = hf_hub_download(
                repo_id=model_id,
                filename="mega-v12/WAN-AIO-mega-I2V-v12.safetensors",
            )
            
            pipe = WanImageToVideoPipeline.from_single_file(
                checkpoint_path,
                torch_dtype=get_dtype(),
            )
            return pipe
        except Exception as e2:
            logger.warning(f"Could not load from single file: {e2}")
            
            # Final fallback: try with official Wan base
            logger.info("Falling back to official Wan model with rapid settings")
            from diffusers import AutoencoderKLWan
            
            base_model = "Wan-AI/Wan2.2-I2V-14B-480P-Diffusers"
            vae = AutoencoderKLWan.from_pretrained(
                base_model,
                subfolder="vae",
                torch_dtype=torch.float32,
            )
            
            pipe = WanImageToVideoPipeline.from_pretrained(
                base_model,
                vae=vae,
                torch_dtype=get_dtype(),
            )
            
            # Store that this is rapid-optimized (4 steps, CFG 1)
            pipe._rapid_mode = True
            return pipe


def load_video_model_sync(model_id: str) -> bool:
    """
    Load video generation model with automatic pipeline detection.
    
    Supported model families:
    - CogVideoX: THUDM/CogVideoX-* models
    - HunyuanVideo: tencent/HunyuanVideo
    - Wan: Wan-AI/Wan2.2-* models (I2V and T2V)
    - LTX-Video: Lightricks/LTX-Video
    """
    logger.info(f"Loading video model: {model_id}")
    
    # Detect model family
    model_family = detect_video_model_family(model_id)
    logger.info(f"Detected video model family: {model_family.value}")

    model_status[model_id] = {
        "type": ModelType.VIDEO,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        # Load appropriate pipeline based on model family
        if model_family == VideoModelFamily.COGVIDEOX:
            pipe = _load_cogvideox_pipeline(model_id)
        elif model_family == VideoModelFamily.HUNYUAN:
            pipe = _load_hunyuan_pipeline(model_id)
        elif model_family == VideoModelFamily.WAN_RAPID:
            pipe = _load_wan_rapid_pipeline(model_id)
        elif model_family == VideoModelFamily.WAN:
            pipe = _load_wan_pipeline(model_id)
        elif model_family == VideoModelFamily.LTX:
            pipe = _load_ltx_pipeline(model_id)
        else:
            # Fallback: try generic DiffusionPipeline
            logger.warning(f"Unknown video model family for {model_id}, trying generic loader")
            from diffusers import DiffusionPipeline
            pipe = DiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=get_dtype(),
                trust_remote_code=True,
            )
        
        # Move to device and enable optimizations
        pipe.to(get_device())
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()
            # Enable VAE tiling for large videos (reduces memory)
            if hasattr(pipe, "vae") and hasattr(pipe.vae, "enable_tiling"):
                pipe.vae.enable_tiling()

        media_models["video"] = pipe
        media_models["video_model_id"] = model_id
        media_models["video_model_family"] = model_family.value

        model_status[model_id] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Video model {model_id} ({model_family.value}) loaded successfully")
        return True

    except Exception as e:
        logger.error(f"Failed to load video model {model_id}: {e}")
        model_status[model_id] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False


async def load_video_model(model_id: str) -> bool:
    """Load video generation model (async wrapper)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, load_video_model_sync, model_id)


def unload_video_model_sync(model_id: str) -> tuple[bool, float | None]:
    """Unload video model and free GPU memory"""
    logger.info(f"Unloading video model: {model_id}")

    if "video" not in media_models:
        logger.warning("No video model is loaded")
        return False, None

    current_model_id = media_models.get("video_model_id", model_id)

    model_status[current_model_id] = {
        "type": ModelType.VIDEO,
        "status": ModelStatus.UNLOADING,
        "error": None,
        "loaded_at": None,
    }

    memory_before = estimate_model_memory()

    try:
        pipe = media_models["video"]

        # Move model to CPU first to free GPU memory
        if hasattr(pipe, "to"):
            pipe.to("cpu")

        # Delete pipeline
        del media_models["video"]
        if "video_model_id" in media_models:
            del media_models["video_model_id"]

        # Force garbage collection
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()

        memory_after = estimate_model_memory()
        freed_memory = None
        if memory_before is not None and memory_after is not None:
            freed_memory = memory_before - memory_after

        model_status[current_model_id] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.NOT_LOADED,
            "error": None,
            "loaded_at": None,
        }

        logger.info(f"Video model unloaded successfully, freed ~{freed_memory:.0f}MB" if freed_memory else "Video model unloaded")
        return True, freed_memory

    except Exception as e:
        logger.error(f"Failed to unload video model: {e}")
        model_status[current_model_id] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        return False, None


async def unload_video_model(model_id: str) -> tuple[bool, float | None]:
    """Unload video model (async wrapper)"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, unload_video_model_sync, model_id)


async def load_model(model_id: str, model_type: ModelType, force: bool = False) -> tuple[bool, str]:
    """
    Load a model of specified type.

    Args:
        model_id: HuggingFace model ID
        model_type: Type of model (llm, image, video)
        force: If True, unload existing model first

    Returns:
        Tuple of (success, message)
    """
    # Check if already loaded
    if model_type == ModelType.LLM:
        if model_id in llm_engines and not force:
            return True, f"Model {model_id} is already loaded"
        if model_id in llm_engines and force:
            await unload_llm_model(model_id)
        success = await load_llm_model(model_id)

    elif model_type == ModelType.IMAGE:
        current_image_model = media_models.get("image_model_id")
        if current_image_model == model_id and not force:
            return True, f"Model {model_id} is already loaded"
        if "image" in media_models:
            # Unload current image model first
            await unload_image_model(current_image_model or model_id)
        success = await load_image_model(model_id)

    elif model_type == ModelType.IMAGE2IMAGE:
        current_image2image_model = media_models.get("image2image_model_id")
        if current_image2image_model == model_id and not force:
            return True, f"Model {model_id} is already loaded"
        if "image2image" in media_models:
            # Unload current image2image model first
            await unload_image2image_model(current_image2image_model or model_id)
        success = await load_image2image_model(model_id)

    elif model_type == ModelType.VIDEO:
        current_video_model = media_models.get("video_model_id")
        if current_video_model == model_id and not force:
            return True, f"Model {model_id} is already loaded"
        if "video" in media_models:
            # Unload current video model first
            await unload_video_model(current_video_model or model_id)
        success = await load_video_model(model_id)

    else:
        return False, f"Unknown model type: {model_type}"

    if success:
        return True, f"Model {model_id} loaded successfully"
    else:
        error_msg = model_status.get(model_id, {}).get("error", "Unknown error")
        return False, f"Failed to load model {model_id}: {error_msg}"


async def unload_model(model_id: str, model_type: ModelType) -> tuple[bool, str, float | None]:
    """
    Unload a model of specified type.

    Args:
        model_id: Model ID to unload
        model_type: Type of model (llm, image, video)

    Returns:
        Tuple of (success, message, freed_memory_mb)
    """
    if model_type == ModelType.LLM:
        if model_id not in llm_engines:
            return False, f"LLM model {model_id} is not loaded", None
        success, freed = await unload_llm_model(model_id)

    elif model_type == ModelType.IMAGE:
        if "image" not in media_models:
            return False, "No image model is loaded", None
        success, freed = await unload_image_model(model_id)

    elif model_type == ModelType.IMAGE2IMAGE:
        if "image2image" not in media_models:
            return False, "No image2image model is loaded", None
        success, freed = await unload_image2image_model(model_id)

    elif model_type == ModelType.VIDEO:
        if "video" not in media_models:
            return False, "No video model is loaded", None
        success, freed = await unload_video_model(model_id)

    else:
        return False, f"Unknown model type: {model_type}", None

    if success:
        return True, f"Model {model_id} unloaded successfully", freed
    else:
        error_msg = model_status.get(model_id, {}).get("error", "Unknown error")
        return False, f"Failed to unload model {model_id}: {error_msg}", None


def get_all_models() -> list[ModelInfo]:
    """Get information about all models (loaded and tracked)"""
    models = []

    # Add loaded LLM models
    for model_id in llm_engines:
        status_info = model_status.get(model_id, {})
        models.append(ModelInfo(
            model_id=model_id,
            model_type=ModelType.LLM,
            status=status_info.get("status", ModelStatus.LOADED),
            name=_get_model_short_name(model_id),
            loaded_at=status_info.get("loaded_at"),
            memory_usage_mb=None,
            error=status_info.get("error"),
        ))

    # Add loaded image model
    if "image" in media_models:
        model_id = media_models.get("image_model_id", "unknown")
        status_info = model_status.get(model_id, {})
        models.append(ModelInfo(
            model_id=model_id,
            model_type=ModelType.IMAGE,
            status=status_info.get("status", ModelStatus.LOADED),
            name=_get_model_short_name(model_id),
            loaded_at=status_info.get("loaded_at"),
            memory_usage_mb=None,
            error=status_info.get("error"),
        ))

    # Add loaded image2image model
    if "image2image" in media_models:
        model_id = media_models.get("image2image_model_id", "unknown")
        status_info = model_status.get(model_id, {})
        models.append(ModelInfo(
            model_id=model_id,
            model_type=ModelType.IMAGE2IMAGE,
            status=status_info.get("status", ModelStatus.LOADED),
            name=_get_model_short_name(model_id),
            loaded_at=status_info.get("loaded_at"),
            memory_usage_mb=None,
            error=status_info.get("error"),
        ))

    # Add loaded video model
    if "video" in media_models:
        model_id = media_models.get("video_model_id", "unknown")
        status_info = model_status.get(model_id, {})
        models.append(ModelInfo(
            model_id=model_id,
            model_type=ModelType.VIDEO,
            status=status_info.get("status", ModelStatus.LOADED),
            name=_get_model_short_name(model_id),
            loaded_at=status_info.get("loaded_at"),
            memory_usage_mb=None,
            error=status_info.get("error"),
        ))

    # Add models with error or loading status that aren't in the loaded lists
    for model_id, status_info in model_status.items():
        status = status_info.get("status")
        if status in [ModelStatus.LOADING, ModelStatus.ERROR, ModelStatus.UNLOADING]:
            # Check if not already added
            if not any(m.model_id == model_id for m in models):
                models.append(ModelInfo(
                    model_id=model_id,
                    model_type=status_info.get("type", ModelType.LLM),
                    status=status,
                    name=_get_model_short_name(model_id),
                    loaded_at=status_info.get("loaded_at"),
                    memory_usage_mb=None,
                    error=status_info.get("error"),
                ))

    return models
