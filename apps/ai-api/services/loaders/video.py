"""
Video model loaders using Diffusers
"""
import gc
import logging
from enum import Enum

import torch

from config import get_device, get_dtype

logger = logging.getLogger(__name__)


class VideoModelFamily(str, Enum):
    """Video model families with different pipeline requirements"""
    COGVIDEOX = "cogvideox"      # THUDM/CogVideoX-* models
    HUNYUAN = "hunyuan"          # tencent/HunyuanVideo
    WAN = "wan"                  # Wan-AI/Wan2.2-* models (official diffusers)
    WAN_RAPID = "wan_rapid"      # Phr00t/WAN2.2-14B-Rapid-AllInOne (FP8 accelerated)
    LTX = "ltx"                  # Lightricks/LTX-Video
    UNKNOWN = "unknown"


# Memory estimates for video models (in MB)
VIDEO_MEMORY_ESTIMATES = {
    VideoModelFamily.COGVIDEOX: 24_000,   # ~24GB
    VideoModelFamily.HUNYUAN: 60_000,     # ~60GB
    VideoModelFamily.WAN: 48_000,         # ~48GB
    VideoModelFamily.WAN_RAPID: 8_000,    # ~8GB (FP8 optimized)
    VideoModelFamily.LTX: 16_000,         # ~16GB
    VideoModelFamily.UNKNOWN: 24_000,     # Default estimate
}


def detect_video_family(model_id: str) -> VideoModelFamily:
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


def estimate_video_memory(model_id: str) -> float:
    """
    Estimate GPU memory required for a video model.
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Estimated memory in MB
    """
    family = detect_video_family(model_id)
    return VIDEO_MEMORY_ESTIMATES.get(family, VIDEO_MEMORY_ESTIMATES[VideoModelFamily.UNKNOWN])


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


def load_video_pipeline(model_id: str) -> tuple[object, float, VideoModelFamily]:
    """
    Load video generation pipeline with automatic family detection.
    
    Supported model families:
    - CogVideoX: THUDM/CogVideoX-* models
    - HunyuanVideo: tencent/HunyuanVideo
    - Wan: Wan-AI/Wan2.2-* models (I2V and T2V)
    - WAN Rapid: Phr00t/WAN2.2-14B-Rapid-AllInOne (FP8)
    - LTX-Video: Lightricks/LTX-Video
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Tuple of (Pipeline, estimated_memory_mb, VideoModelFamily)
    """
    logger.info(f"Loading video model: {model_id}")
    
    # Detect model family
    model_family = detect_video_family(model_id)
    logger.info(f"Detected video model family: {model_family.value}")
    
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
    
    memory_estimate = estimate_video_memory(model_id)
    logger.info(f"Video model {model_id} ({model_family.value}) loaded, estimated memory: {memory_estimate}MB")
    
    return pipe, memory_estimate, model_family


def unload_video_pipeline(pipe: object) -> float:
    """
    Unload video pipeline and free GPU memory.
    
    Args:
        pipe: Diffusers video pipeline instance
        
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
    
    # Delete pipeline
    del pipe
    
    # Force garbage collection
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    memory_after = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    freed_memory = max(0, memory_before - memory_after)
    
    logger.info(f"Video pipeline unloaded, freed ~{freed_memory:.0f}MB")
    return freed_memory

