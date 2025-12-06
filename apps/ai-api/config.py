"""
AI API Configuration
"""
import os
from pathlib import Path

import torch


# Device configuration - use functions to avoid early CUDA initialization
def get_device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_dtype() -> torch.dtype:
    return torch.bfloat16 if torch.cuda.is_available() else torch.float32


# LLM configuration
MODEL_IDS = os.environ.get(
    "MODEL_IDS",
    "huihui-ai/Huihui-Qwen3-VL-8B-Instruct-abliterated"
).split(",")
TENSOR_PARALLEL_SIZE = int(os.environ.get("TENSOR_PARALLEL_SIZE", "1"))
GPU_MEMORY_UTILIZATION = float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.95"))
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "8192"))

# Media configuration - Text to Image
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "Tongyi-MAI/Z-Image-Turbo")
# Available text2image models for selection
IMAGE_MODELS = [
    "Tongyi-MAI/Z-Image-Turbo",  # Fast, high quality, 8 steps
    "Heartsync/NSFW-Uncensored",  # SDXL-based, uncensored content
    "stabilityai/stable-diffusion-xl-base-1.0",  # SDXL base
]

# Image2Image models - for transforming existing images
# Uses SDXL refiner or base models via AutoPipelineForImage2Image
IMAGE2IMAGE_MODEL = os.environ.get("IMAGE2IMAGE_MODEL", "stabilityai/stable-diffusion-xl-refiner-1.0")
# Available image2image models for selection
IMAGE2IMAGE_MODELS = [
    "stabilityai/stable-diffusion-xl-refiner-1.0",  # SDXL refiner, good for img2img
    "stabilityai/stable-diffusion-xl-base-1.0",  # SDXL base
    "Heartsync/NSFW-Uncensored",  # SDXL-based, uncensored content (NSFW)
    # "Tongyi-MAI/Z-Image-Edit",  # Coming soon - text-guided editing
]
# Video models - supports multiple families with automatic pipeline detection
# Supported models:
# - Phr00t/WAN2.2-14B-Rapid-AllInOne (MEGA - T2V+I2V+VACE, FP8, 4 steps, fastest)
# - Lightricks/LTX-Video (fast, 30fps, low VRAM ~16GB)
# - THUDM/CogVideoX-5b-I2V (good quality, moderate VRAM ~24GB)
# - Wan-AI/Wan2.2-I2V-14B-480P-Diffusers (high quality I2V, high VRAM ~48GB)
# - tencent/HunyuanVideo (highest quality T2V, requires 60GB+ VRAM)
VIDEO_MODEL = os.environ.get("VIDEO_MODEL", "Phr00t/WAN2.2-14B-Rapid-AllInOne")
# Available video models for selection
VIDEO_MODELS = [
    "Phr00t/WAN2.2-14B-Rapid-AllInOne",  # MEGA: T2V+I2V+VACE, FP8, 4 steps, 8GB VRAM!
    "Lightricks/LTX-Video",  # Fast, real-time capable, 30fps
    "THUDM/CogVideoX-5b-I2V",  # Good quality I2V
    "Wan-AI/Wan2.2-I2V-14B-480P-Diffusers",  # High quality I2V, 24fps
    "tencent/HunyuanVideo",  # Highest quality T2V, 30fps
]
ENABLE_IMAGE = os.environ.get("ENABLE_IMAGE", "true").lower() == "true"
ENABLE_IMAGE2IMAGE = os.environ.get("ENABLE_IMAGE2IMAGE", "true").lower() == "true"
ENABLE_VIDEO = os.environ.get("ENABLE_VIDEO", "true").lower() == "true"

# Output directory
OUTPUT_DIR = Path("./outputs")
OUTPUT_DIR.mkdir(exist_ok=True)
