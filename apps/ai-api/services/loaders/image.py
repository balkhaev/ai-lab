"""
Image model loaders using Diffusers
"""
import gc
import logging
from dataclasses import dataclass

import torch

from config import get_device, get_dtype

logger = logging.getLogger(__name__)


# ============== LoRA Configurations ==============

@dataclass
class LoRAConfig:
    """Configuration for a LoRA model"""
    base_model_id: str  # Base SDXL model to use
    lora_repo: str  # HuggingFace repo or local path
    lora_weight_name: str | None = None  # safetensors filename (optional)
    lora_scale: float = 1.0  # Adapter weight scale
    trigger_word: str | None = None  # Trigger word to add to prompt


# Virtual model IDs that map to base model + LoRA
LORA_MODELS: dict[str, LoRAConfig] = {
    "nsfw-undress": LoRAConfig(
        base_model_id="Heartsync/NSFW-Uncensored",
        lora_repo="ntc-ai/SDXL-LoRA-slider.sexy",
        lora_weight_name="sexy.safetensors",
        lora_scale=1.5,
        trigger_word="sexy",
    ),
}


def get_lora_config(model_id: str) -> LoRAConfig | None:
    """Get LoRA config for a virtual model ID"""
    return LORA_MODELS.get(model_id)


# Memory estimates for image models (in MB)
IMAGE_MEMORY_ESTIMATES = {
    "sd15": 4_000,       # ~4GB for SD 1.5
    "sd21": 5_000,       # ~5GB for SD 2.1
    "sdxl": 7_000,       # ~7GB for SDXL
    "z-image": 14_000,   # ~14GB for Z-Image-Turbo (8B model)
    "flux": 16_000,      # ~16GB for Flux
    "longcat": 19_000,   # ~19GB for LongCat-Image-Edit
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
    
    if "longcat" in model_id_lower:
        return IMAGE_MEMORY_ESTIMATES["longcat"]
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


def is_longcat_model(model_id: str) -> bool:
    """Check if model is LongCat-Image-Edit"""
    return "longcat" in model_id.lower()


def load_longcat_pipeline(model_id: str) -> tuple[object, float]:
    """
    Load LongCat-Image-Edit pipeline.
    
    LongCat-Image-Edit is a SOTA bilingual (Chinese-English) image editing model.
    It supports global/local editing, text modification, and reference-guided editing.
    
    Requirements:
    - Install: pip install git+https://github.com/meituan-longcat/LongCat-Image.git
    - VRAM: ~19GB with CPU offload
    
    Args:
        model_id: HuggingFace model ID (meituan-longcat/LongCat-Image-Edit)
        
    Returns:
        Tuple of (Pipeline, estimated_memory_mb)
    """
    from diffusers import DiffusionPipeline
    from transformers import AutoProcessor
    
    logger.info(f"Loading LongCat-Image-Edit model: {model_id}")
    
    try:
        # LongCat uses custom pipeline with trust_remote_code
        pipe = DiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
            trust_remote_code=True,
            use_safetensors=True,
        )
        
        # Use CPU offload to save VRAM (~19GB required)
        if get_device() == "cuda":
            pipe.enable_model_cpu_offload()
        
        memory_estimate = estimate_image_memory(model_id)
        logger.info(f"LongCat model {model_id} loaded, estimated memory: {memory_estimate}MB")
        
        return pipe, memory_estimate
        
    except Exception as e:
        logger.error(
            f"Failed to load LongCat model: {e}. "
            "Please install LongCat: pip install git+https://github.com/meituan-longcat/LongCat-Image.git"
        )
        raise RuntimeError(
            f"LongCat model requires longcat_image package. "
            f"Run: pip install git+https://github.com/meituan-longcat/LongCat-Image.git\n"
            f"Original error: {e}"
        ) from e


def load_image2image_pipeline(model_id: str) -> tuple[object, float]:
    """
    Load image-to-image pipeline with optional LoRA support.
    
    Supports:
    - SDXL-based models (stabilityai/stable-diffusion-xl-refiner-1.0, etc.)
    - LongCat-Image-Edit (meituan-longcat/LongCat-Image-Edit)
    - Virtual LoRA model IDs (e.g., "nsfw-undress")
    
    Args:
        model_id: HuggingFace model ID or virtual LoRA model ID
        
    Returns:
        Tuple of (Pipeline, estimated_memory_mb)
    """
    # Check if this is a virtual LoRA model ID
    lora_config = get_lora_config(model_id)
    if lora_config:
        return load_image2image_with_lora(lora_config)
    
    # LongCat has its own custom pipeline (no LoRA support)
    if is_longcat_model(model_id):
        return load_longcat_pipeline(model_id)
    
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


def load_image2image_with_lora(config: LoRAConfig) -> tuple[object, float]:
    """
    Load image-to-image pipeline with LoRA adapter.
    
    Args:
        config: LoRA configuration with base model and adapter info
        
    Returns:
        Tuple of (Pipeline, estimated_memory_mb)
    """
    from diffusers import AutoPipelineForImage2Image
    
    logger.info(f"Loading image2image model with LoRA: {config.base_model_id} + {config.lora_repo}")
    
    # Load base model
    pipe = AutoPipelineForImage2Image.from_pretrained(
        config.base_model_id,
        torch_dtype=get_dtype(),
        use_safetensors=True,
        variant="fp16" if get_dtype() in [torch.bfloat16, torch.float16] else None,
    )
    
    # Load LoRA weights
    logger.info(f"Loading LoRA weights from: {config.lora_repo}")
    try:
        if config.lora_weight_name:
            pipe.load_lora_weights(config.lora_repo, weight_name=config.lora_weight_name)
        else:
            pipe.load_lora_weights(config.lora_repo)
        
        # Set LoRA scale using fuse_lora for better performance
        pipe.fuse_lora(lora_scale=config.lora_scale)
        logger.info(f"LoRA fused successfully with scale {config.lora_scale}")
    except Exception as e:
        logger.error(f"Failed to load LoRA weights: {e}")
        raise RuntimeError(f"Failed to load LoRA from {config.lora_repo}: {e}") from e
    
    pipe.to(get_device())
    if get_device() == "cuda":
        pipe.enable_model_cpu_offload()
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()
    
    # Estimate memory: base model + LoRA overhead (~300MB)
    memory_estimate = estimate_image_memory(config.base_model_id) + 300
    logger.info(f"Image2image+LoRA loaded, estimated memory: {memory_estimate}MB")
    
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



