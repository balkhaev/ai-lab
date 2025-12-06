"""
Media generation service - image and video generation
"""
import base64
import logging
from datetime import datetime, timezone

import torch
from PIL import Image

from config import (
    IMAGE_MODEL,
    IMAGE2IMAGE_MODEL,
    VIDEO_MODEL,
    OUTPUT_DIR,
    get_device,
    get_dtype,
)
from state import media_models, video_tasks, model_status

# Special handling for different image model types
ZIMAGE_MODELS = ["Tongyi-MAI/Z-Image-Turbo", "Tongyi-MAI/Z-Image-Edit"]
SDXL_MODELS = ["Heartsync/NSFW-Uncensored", "stabilityai/stable-diffusion-xl-base-1.0"]

logger = logging.getLogger(__name__)


def _unload_llm_models_sync():
    """Unload all LLM models synchronously to free GPU memory for media models"""
    import gc
    from models.management import ModelType, ModelStatus
    from state import llm_engines, model_info
    
    if not llm_engines:
        return
    
    logger.info(f"Unloading LLM models to free GPU memory: {list(llm_engines.keys())}")
    
    for model_id in list(llm_engines.keys()):
        try:
            engine = llm_engines[model_id]
            # Try to shutdown engine (vLLM specific)
            if hasattr(engine, "shutdown_background_loop"):
                engine.shutdown_background_loop()
            del llm_engines[model_id]
            if model_id in model_info:
                del model_info[model_id]
            # Update status tracking
            model_status[model_id] = {
                "type": ModelType.LLM,
                "status": ModelStatus.NOT_LOADED,
                "error": None,
                "loaded_at": None,
            }
            logger.info(f"Unloaded LLM model: {model_id}")
        except Exception as e:
            logger.warning(f"Error unloading LLM model {model_id}: {e}")
    
    # Force garbage collection and clear CUDA cache
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    logger.info("LLM models unloaded, GPU memory freed")


def load_image_model(model_id: str | None = None):
    """
    Load image generation model (lazy loading for routes/media.py).
    
    Supports different model types:
    - Z-Image models (ZImagePipeline): Tongyi-MAI/Z-Image-Turbo
    - SDXL models (StableDiffusionXLPipeline): Heartsync/NSFW-Uncensored, stabilityai/sdxl
    
    Args:
        model_id: Optional model ID to load. If None, uses IMAGE_MODEL from config.
    """
    from diffusers import DiffusionPipeline
    from models.management import ModelType, ModelStatus
    from state import llm_engines

    target_model = model_id or IMAGE_MODEL
    logger.info(f"Loading image model: {target_model}")
    
    # Unload LLM models first to free GPU memory
    if llm_engines:
        _unload_llm_models_sync()

    # Update status
    model_status[target_model] = {
        "type": ModelType.IMAGE,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        # Z-Image models need trust_remote_code for custom pipeline
        if any(z in target_model for z in ["Z-Image", "z-image"]):
            try:
                pipe = DiffusionPipeline.from_pretrained(
                    target_model,
                    torch_dtype=get_dtype(),
                    trust_remote_code=True,
                    low_cpu_mem_usage=False,
                )
            except AttributeError as e:
                # ZImagePipeline not available - need newer diffusers
                # pip install git+https://github.com/huggingface/diffusers.git -U
                logger.error(
                    f"Failed to load Z-Image model: {e}. "
                    "Please update diffusers: pip install git+https://github.com/huggingface/diffusers.git -U"
                )
                raise RuntimeError(
                    f"Z-Image model requires latest diffusers from git. "
                    f"Run: pip install git+https://github.com/huggingface/diffusers.git -U\n"
                    f"Original error: {e}"
                ) from e
        else:
            # SDXL and other models use DiffusionPipeline
            pipe = DiffusionPipeline.from_pretrained(
                target_model,
                torch_dtype=get_dtype(),
                use_safetensors=True,
                variant="fp16" if get_dtype() in [torch.bfloat16, torch.float16] else None,
            )
        
        pipe.to(get_device())
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()
            # Enable VAE slicing for SDXL models
            if hasattr(pipe, "enable_vae_slicing"):
                pipe.enable_vae_slicing()

        # Track model ID for management
        media_models["image_model_id"] = target_model

        model_status[target_model] = {
            "type": ModelType.IMAGE,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Image model {target_model} loaded successfully")
        return pipe

    except Exception as e:
        model_status[target_model] = {
            "type": ModelType.IMAGE,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        raise


def load_image2image_model(model_id: str | None = None):
    """
    Load image-to-image generation model (lazy loading for routes/media.py).
    
    Supports SDXL-based models like:
    - Heartsync/NSFW-Uncensored (SDXL-based, uncensored)
    - stabilityai/stable-diffusion-xl-base-1.0
    
    Args:
        model_id: Optional model ID to load. If None, uses IMAGE2IMAGE_MODEL from config.
    """
    from diffusers import AutoPipelineForImage2Image
    from models.management import ModelType, ModelStatus
    from state import llm_engines

    target_model = model_id or IMAGE2IMAGE_MODEL
    logger.info(f"Loading image2image model: {target_model}")
    
    # Unload LLM models first to free GPU memory
    if llm_engines:
        _unload_llm_models_sync()

    # Update status
    model_status[target_model] = {
        "type": ModelType.IMAGE2IMAGE,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        # AutoPipelineForImage2Image automatically selects the right pipeline
        # For SDXL models it uses StableDiffusionXLImg2ImgPipeline
        pipe = AutoPipelineForImage2Image.from_pretrained(
            target_model,
            torch_dtype=get_dtype(),
            use_safetensors=True,
            variant="fp16" if get_dtype() == torch.bfloat16 or get_dtype() == torch.float16 else None,
        )
        pipe.to(get_device())
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()
            # Enable VAE slicing for lower memory usage
            if hasattr(pipe, "enable_vae_slicing"):
                pipe.enable_vae_slicing()

        # Track model ID for management
        media_models["image2image_model_id"] = target_model

        model_status[target_model] = {
            "type": ModelType.IMAGE2IMAGE,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Image2image model {target_model} loaded successfully")
        return pipe

    except Exception as e:
        model_status[target_model] = {
            "type": ModelType.IMAGE2IMAGE,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        raise


def load_video_model():
    """
    Load video generation model (lazy loading for routes/media.py).
    
    Supports multiple video model families:
    - Phr00t/WAN Rapid: FP8 accelerated, 4 steps, 8GB VRAM
    - CogVideoX: THUDM/CogVideoX-* models
    - HunyuanVideo: tencent/HunyuanVideo
    - Wan: Wan-AI/Wan2.2-* models (I2V and T2V)
    - LTX-Video: Lightricks/LTX-Video
    """
    from models.management import ModelType, ModelStatus
    from services.model_manager import (
        detect_video_model_family,
        VideoModelFamily,
        _load_cogvideox_pipeline,
        _load_hunyuan_pipeline,
        _load_wan_pipeline,
        _load_wan_rapid_pipeline,
        _load_ltx_pipeline,
    )
    from state import llm_engines

    logger.info(f"Loading video model: {VIDEO_MODEL}")
    
    # Unload LLM models first to free GPU memory
    if llm_engines:
        _unload_llm_models_sync()
    
    # Detect model family
    model_family = detect_video_model_family(VIDEO_MODEL)
    logger.info(f"Detected video model family: {model_family.value}")

    # Update status
    model_status[VIDEO_MODEL] = {
        "type": ModelType.VIDEO,
        "status": ModelStatus.LOADING,
        "error": None,
        "loaded_at": None,
    }

    try:
        # Load appropriate pipeline based on model family
        if model_family == VideoModelFamily.COGVIDEOX:
            pipe = _load_cogvideox_pipeline(VIDEO_MODEL)
        elif model_family == VideoModelFamily.HUNYUAN:
            pipe = _load_hunyuan_pipeline(VIDEO_MODEL)
        elif model_family == VideoModelFamily.WAN_RAPID:
            pipe = _load_wan_rapid_pipeline(VIDEO_MODEL)
        elif model_family == VideoModelFamily.WAN:
            pipe = _load_wan_pipeline(VIDEO_MODEL)
        elif model_family == VideoModelFamily.LTX:
            pipe = _load_ltx_pipeline(VIDEO_MODEL)
        else:
            # Fallback: try generic DiffusionPipeline
            logger.warning(f"Unknown video model family for {VIDEO_MODEL}, trying generic loader")
            from diffusers import DiffusionPipeline
            pipe = DiffusionPipeline.from_pretrained(
                VIDEO_MODEL,
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

        # Track model ID and family for management
        media_models["video_model_id"] = VIDEO_MODEL
        media_models["video_model_family"] = model_family.value

        model_status[VIDEO_MODEL] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.LOADED,
            "error": None,
            "loaded_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(f"Video model {VIDEO_MODEL} ({model_family.value}) loaded successfully")
        return pipe

    except Exception as e:
        model_status[VIDEO_MODEL] = {
            "type": ModelType.VIDEO,
            "status": ModelStatus.ERROR,
            "error": str(e),
            "loaded_at": None,
        }
        raise


def _generate_video_cogvideox(
    pipe,
    prompt: str,
    image: Image.Image,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    generator: torch.Generator,
):
    """Generate video using CogVideoX pipeline"""
    return pipe(
        prompt=prompt,
        image=image,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        num_frames=num_frames,
        generator=generator,
    )


def _generate_video_hunyuan(
    pipe,
    prompt: str,
    image: Image.Image,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    generator: torch.Generator,
):
    """Generate video using HunyuanVideo pipeline"""
    # HunyuanVideo is primarily T2V, but can use image as reference
    height, width = 720, 1280  # Default HunyuanVideo resolution
    if image is not None:
        # Use image dimensions as base
        width, height = image.size
        # Round to nearest supported resolution (divisible by 16)
        height = (height // 16) * 16
        width = (width // 16) * 16
    
    return pipe(
        prompt=prompt,
        height=height,
        width=width,
        num_frames=num_frames,
        guidance_scale=guidance_scale,
        num_inference_steps=num_inference_steps,
        generator=generator,
    )


def _generate_video_wan(
    pipe,
    prompt: str,
    image: Image.Image,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    generator: torch.Generator,
):
    """Generate video using Wan pipeline (I2V or T2V)"""
    # Determine resolution from image or use default
    height, width = 480, 832  # Default Wan 480P resolution
    if image is not None:
        width, height = image.size
        # Round to nearest resolution divisible by 16
        height = (height // 16) * 16
        width = (width // 16) * 16
    
    kwargs = {
        "prompt": prompt,
        "height": height,
        "width": width,
        "num_frames": num_frames,
        "guidance_scale": guidance_scale,
        "num_inference_steps": num_inference_steps,
        "generator": generator,
    }
    
    # Add image for I2V models
    if image is not None:
        kwargs["image"] = image
    
    return pipe(**kwargs)


def _generate_video_ltx(
    pipe,
    prompt: str,
    image: Image.Image,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    generator: torch.Generator,
):
    """Generate video using LTX-Video pipeline"""
    # LTX works best at specific resolutions
    height, width = 480, 704  # Default LTX resolution
    if image is not None:
        width, height = image.size
        # Round to nearest resolution divisible by 32 (LTX requirement)
        height = (height // 32) * 32
        width = (width // 32) * 32
    
    # Ensure num_frames is divisible by 8 + 1 (LTX requirement)
    num_frames = ((num_frames - 1) // 8) * 8 + 1
    
    kwargs = {
        "prompt": prompt,
        "height": height,
        "width": width,
        "num_frames": num_frames,
        "guidance_scale": guidance_scale,
        "num_inference_steps": num_inference_steps,
        "generator": generator,
    }
    
    # Add image for I2V
    if image is not None:
        kwargs["image"] = image
    
    return pipe(**kwargs)


def _generate_video_wan_rapid(
    pipe,
    prompt: str,
    image: Image.Image,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    generator: torch.Generator,
):
    """
    Generate video using Phr00t WAN Rapid pipeline.
    
    Optimized settings from Phr00t:
    - 4 inference steps (overrides user setting for optimal quality)
    - CFG 1.0 (overrides user setting)
    - euler_a/beta sampler recommended
    - Works on 8GB+ VRAM
    """
    # Determine resolution from image or use default
    height, width = 480, 832  # Default Wan 480P resolution
    if image is not None:
        width, height = image.size
        # Round to nearest resolution divisible by 16
        height = (height // 16) * 16
        width = (width // 16) * 16
    
    # Override with optimal Rapid settings
    # Phr00t recommends: 4 steps, CFG 1
    optimal_steps = 4
    optimal_cfg = 1.0
    
    logger.info(f"WAN Rapid: Using optimized settings (steps={optimal_steps}, CFG={optimal_cfg})")
    
    kwargs = {
        "prompt": prompt,
        "height": height,
        "width": width,
        "num_frames": num_frames,
        "guidance_scale": optimal_cfg,  # Force CFG 1 for Rapid
        "num_inference_steps": optimal_steps,  # Force 4 steps for Rapid
        "generator": generator,
    }
    
    # Add image for I2V models
    if image is not None:
        kwargs["image"] = image
    
    return pipe(**kwargs)


async def process_video_task(
    task_id: str,
    image: Image.Image,
    prompt: str,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    seed: int | None
):
    """
    Background task for video generation.
    
    Automatically handles different video model families with appropriate parameters.
    """
    import imageio
    import numpy as np
    from services.model_manager import VideoModelFamily

    logger.info(f"Starting video generation task: {task_id}")
    video_tasks[task_id]["status"] = "processing"

    try:
        # Lazy load model
        if "video" not in media_models:
            media_models["video"] = load_video_model()

        pipe = media_models["video"]
        model_family = media_models.get("video_model_family", VideoModelFamily.UNKNOWN.value)
        
        logger.info(f"Generating video with {model_family} model")

        actual_seed = seed if seed is not None else torch.randint(0, 2**32, (1,)).item()
        generator = torch.Generator(device=get_device()).manual_seed(actual_seed)

        # Generate video using appropriate method for model family
        if model_family == VideoModelFamily.COGVIDEOX.value:
            result = _generate_video_cogvideox(
                pipe, prompt, image, num_inference_steps, guidance_scale, num_frames, generator
            )
        elif model_family == VideoModelFamily.HUNYUAN.value:
            result = _generate_video_hunyuan(
                pipe, prompt, image, num_inference_steps, guidance_scale, num_frames, generator
            )
        elif model_family == VideoModelFamily.WAN.value:
            result = _generate_video_wan(
                pipe, prompt, image, num_inference_steps, guidance_scale, num_frames, generator
            )
        elif model_family == VideoModelFamily.LTX.value:
            result = _generate_video_ltx(
                pipe, prompt, image, num_inference_steps, guidance_scale, num_frames, generator
            )
        else:
            # Generic fallback - try standard call
            logger.warning(f"Unknown model family {model_family}, using generic call")
            result = pipe(
                prompt=prompt,
                image=image,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                num_frames=num_frames,
                generator=generator,
            )

        # Export frames to video
        frames = result.frames[0]

        # Determine FPS based on model family
        fps = 8  # Default
        if model_family == VideoModelFamily.HUNYUAN.value:
            fps = 30  # HunyuanVideo generates 30fps
        elif model_family in (VideoModelFamily.WAN.value, VideoModelFamily.WAN_RAPID.value):
            fps = 24  # Wan generates 24fps
        elif model_family == VideoModelFamily.LTX.value:
            fps = 30  # LTX generates 30fps

        output_path = OUTPUT_DIR / f"{task_id}.mp4"
        writer = imageio.get_writer(str(output_path), fps=fps, codec="libx264")

        for frame in frames:
            if isinstance(frame, Image.Image):
                frame = frame.convert("RGB")
                frame = np.array(frame)
            writer.append_data(frame)

        writer.close()

        # Read and encode video
        with open(output_path, "rb") as f:
            video_base64 = base64.b64encode(f.read()).decode("utf-8")

        video_tasks[task_id]["status"] = "completed"
        video_tasks[task_id]["video_base64"] = video_base64
        video_tasks[task_id]["progress"] = 100.0

        logger.info(f"Video generation task completed: {task_id}")

    except Exception as e:
        logger.error(f"Video generation task failed: {task_id}, error: {e}")
        video_tasks[task_id]["status"] = "failed"
        video_tasks[task_id]["error"] = str(e)
