"""
Health and info endpoints
"""
import torch
from fastapi import APIRouter

from config import get_device, ENABLE_IMAGE, ENABLE_VIDEO
from state import llm_engines, media_models

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Health check",
    description="Returns the health status of the API and loaded models",
)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": get_device(),
        "cuda_available": torch.cuda.is_available(),
        "llm_models": list(llm_engines.keys()),
        "media_models": list(media_models.keys()),
        "features": {
            "llm": len(llm_engines) > 0,
            "image": ENABLE_IMAGE,
            "video": ENABLE_VIDEO,
        }
    }
