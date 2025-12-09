"""
Image model loaders using Diffusers
"""
import gc
import logging

import torch

from config import get_device, get_dtype

logger = logging.getLogger(__name__)


# Memory estimates for image models (in MB)
IMAGE_MEMORY_ESTIMATES = {
    "sd15": 4_000,       # ~4GB for SD 1.5
    "sd21": 5_000,       # ~5GB for SD 2.1
    "sdxl": 7_000,       # ~7GB for SDXL
    "z-image": 14_000,   # ~14GB for Z-Image-Turbo (8B model)
    "flux": 16_000,      # ~16GB for Flux
    "default": 8_000,    # Default estimate
}


def estimate_image_memory(model_id: str) -> float:
    """
    Estimate GPU memory required for an image model.
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Estimated memory in MB
    """
    model_id_lower = model_id.lower()
    
    if "z-image" in model_id_lower:
        return IMAGE_MEMORY_ESTIMATES["z-image"]
    if "flux" in model_id_lower:
        return IMAGE_MEMORY_ESTIMATES["flux"]
    if "xl" in model_id_lower or "sdxl" in model_id_lower:
        return IMAGE_MEMORY_ESTIMATES["sdxl"]
    if "2.1" in model_id or "2-1" in model_id:
        return IMAGE_MEMORY_ESTIMATES["sd21"]
    if "1.5" in model_id or "1-5" in model_id:
        return IMAGE_MEMORY_ESTIMATES["sd15"]
    
    return IMAGE_MEMORY_ESTIMATES["default"]


def load_image_pipeline(model_id: str) -> tuple[object, float]:
    """
    Load image generation pipeline.
    
    Supports different model types:
    - Z-Image models (ZImagePipeline): Tongyi-MAI/Z-Image-Turbo
    - SDXL models (StableDiffusionXLPipeline)
    - SD 1.5/2.1 models
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Tuple of (DiffusionPipeline, estimated_memory_mb)
    """
    from diffusers import DiffusionPipeline
    
    logger.info(f"Loading image model: {model_id}")
    
    # Z-Image models need trust_remote_code for custom pipeline
    if any(z in model_id for z in ["Z-Image", "z-image"]):
        try:
            pipe = DiffusionPipeline.from_pretrained(
                model_id,
                torch_dtype=get_dtype(),
                trust_remote_code=True,
                low_cpu_mem_usage=False,
            )
        except AttributeError as e:
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
            model_id,
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
    
    memory_estimate = estimate_image_memory(model_id)
    logger.info(f"Image model {model_id} loaded, estimated memory: {memory_estimate}MB")
    
    return pipe, memory_estimate


def load_image2image_pipeline(model_id: str) -> tuple[object, float]:
    """
    Load image-to-image pipeline.
    
    Supports SDXL-based models like:
    - stabilityai/stable-diffusion-xl-refiner-1.0
    - Heartsync/NSFW-Uncensored
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Tuple of (Pipeline, estimated_memory_mb)
    """
    from diffusers import AutoPipelineForImage2Image
    
    logger.info(f"Loading image2image model: {model_id}")
    
    pipe = AutoPipelineForImage2Image.from_pretrained(
        model_id,
        torch_dtype=get_dtype(),
        use_safetensors=True,
        variant="fp16" if get_dtype() in [torch.bfloat16, torch.float16] else None,
    )
    pipe.to(get_device())
    if get_device() == "cuda":
        pipe.enable_model_cpu_offload()
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()
    
    memory_estimate = estimate_image_memory(model_id)
    logger.info(f"Image2image model {model_id} loaded, estimated memory: {memory_estimate}MB")
    
    return pipe, memory_estimate


def unload_image_pipeline(pipe: object) -> float:
    """
    Unload image pipeline and free GPU memory.
    
    Args:
        pipe: Diffusers pipeline instance
        
    Returns:
        Estimated freed memory in MB
    """
    memory_before = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    
    try:
        # Move model to CPU first to free GPU memory
        if hasattr(pipe, "to"):
            pipe.to("cpu")
    except Exception as e:
        logger.warning(f"Error moving pipeline to CPU: {e}")
    
    # Delete pipeline components
    del pipe
    
    # Force garbage collection
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    memory_after = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    freed_memory = max(0, memory_before - memory_after)
    
    logger.info(f"Image pipeline unloaded, freed ~{freed_memory:.0f}MB")
    return freed_memory


