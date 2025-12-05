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
    "DavidAU/Llama3.2-24B-A3B-II-Dark-Champion-INSTRUCT-Heretic-Abliterated-Uncensored"
).split(",")
TENSOR_PARALLEL_SIZE = int(os.environ.get("TENSOR_PARALLEL_SIZE", "1"))
GPU_MEMORY_UTILIZATION = float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.95"))
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "8192"))

# Media configuration
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "Tongyi-MAI/Z-Image-Turbo")
VIDEO_MODEL = os.environ.get("VIDEO_MODEL", "FX-FeiHou/wan2.2-Remix")
ENABLE_IMAGE = os.environ.get("ENABLE_IMAGE", "true").lower() == "true"
ENABLE_VIDEO = os.environ.get("ENABLE_VIDEO", "true").lower() == "true"

# Output directory
OUTPUT_DIR = Path("./outputs")
OUTPUT_DIR.mkdir(exist_ok=True)
