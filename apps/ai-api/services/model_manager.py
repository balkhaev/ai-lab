"""
Model Manager Service - Dynamic loading and unloading of models
"""
import asyncio
import gc
import logging
from datetime import datetime, timezone

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
        # Fallback to torch (may not show vLLM memory)
        total = torch.cuda.get_device_properties(0).total_memory / (1024 * 1024)
        reserved = torch.cuda.memory_reserved(0) / (1024 * 1024)
        free = total - reserved

        return total, reserved, free


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


def load_video_model_sync(model_id: str) -> bool:
    """Load video generation model"""
    from diffusers import CogVideoXImageToVideoPipeline

    logger.info(f"Loading video model: {model_id}")

    model_status[model_id] = {
        "type": ModelType.VIDEO,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        pipe = CogVideoXImageToVideoPipeline.from_pretrained(
            model_id,
            torch_dtype=get_dtype(),
        )
        pipe.to(get_device())
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()

        media_models["video"] = pipe
        media_models["video_model_id"] = model_id

        model_status[model_id] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Video model {model_id} loaded successfully")
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
