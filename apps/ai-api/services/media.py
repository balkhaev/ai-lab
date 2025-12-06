"""
Media generation service - video generation helpers

Note: Model loading is now handled by ModelOrchestrator.
This module only contains video generation helper functions.
"""
import logging

import torch
from PIL import Image

logger = logging.getLogger(__name__)


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
