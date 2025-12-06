"""
Health and info endpoints
"""
import torch
from fastapi import APIRouter

from config import get_device, ENABLE_IMAGE, ENABLE_VIDEO
from models.management import ModelType
from services.orchestrator import orchestrator

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Health check",
    description="Returns the health status of the API and loaded models",
)
async def health_check():
    """Health check endpoint"""
    loaded_models = orchestrator.list_loaded()
    
    # Categorize models by type
    llm_models = [m.model_id for m in loaded_models if m.model_type == ModelType.LLM]
    media_models = [m.model_id for m in loaded_models if m.model_type in (ModelType.IMAGE, ModelType.IMAGE2IMAGE, ModelType.VIDEO)]
    
    return {
        "status": "healthy",
        "device": get_device(),
        "cuda_available": torch.cuda.is_available(),
        "llm_models": llm_models,
        "media_models": media_models,
        "features": {
            "llm": len(llm_models) > 0,
            "image": ENABLE_IMAGE,
            "video": ENABLE_VIDEO,
        }
    }
