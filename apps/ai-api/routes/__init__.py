"""
API routes
"""
from routes.health import router as health_router
from routes.llm import router as llm_router
from routes.media import router as media_router
from routes.models import router as models_router

__all__ = [
    "health_router",
    "llm_router",
    "media_router",
    "models_router",
]
