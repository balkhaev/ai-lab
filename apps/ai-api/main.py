"""
AI API - Unified service for LLM inference and media generation
"""
# IMPORTANT: Set multiprocessing start method before any CUDA imports
import os
os.environ.setdefault("VLLM_WORKER_MULTIPROC_METHOD", "spawn")

import multiprocessing
try:
    multiprocessing.set_start_method('spawn')
except RuntimeError:
    pass  # Already set

import logging
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import MODEL_IDS
from state import llm_engines, model_info, media_models
from services.llm import load_llm_model
from routes import health_router, llm_router, media_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("ai-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load models on startup, cleanup on shutdown"""
    logger.info("=" * 60)
    logger.info("AI API starting up...")
    logger.info("=" * 60)

    # Load LLM models
    llm_count = 0
    for model_id in MODEL_IDS:
        model_id = model_id.strip()
        if model_id:
            try:
                llm_engines[model_id] = await load_llm_model(model_id)
                llm_count += 1
            except Exception as e:
                logger.error(f"Failed to load model {model_id}: {e}")

    # Log initialization complete
    logger.info("=" * 60)
    logger.info("AI API initialization complete!")
    logger.info(f"  - LLM models loaded: {llm_count}")
    logger.info(f"  - Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
    if torch.cuda.is_available():
        logger.info(f"  - GPU: {torch.cuda.get_device_name(0)}")
        logger.info(f"  - GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    logger.info("  - Swagger UI: http://0.0.0.0:8000/docs")
    logger.info("  - ReDoc: http://0.0.0.0:8000/redoc")
    logger.info("=" * 60)

    yield

    # Cleanup
    logger.info("AI API shutting down...")
    llm_engines.clear()
    model_info.clear()
    media_models.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.info("Cleanup complete")


# Create FastAPI app with OpenAPI configuration
app = FastAPI(
    title="AI API",
    description="""
## Unified API for LLM inference and media generation

### Features

- **LLM Chat** - Chat completions with streaming support
- **Model Comparison** - Compare responses from multiple models
- **Image Generation** - Generate images from text prompts
- **Video Generation** - Generate videos from images and prompts

### Authentication

Currently no authentication is required.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=[
        {
            "name": "Health",
            "description": "Health check and system status endpoints",
        },
        {
            "name": "LLM",
            "description": "Large Language Model inference endpoints",
        },
        {
            "name": "Media Generation",
            "description": "Image and video generation endpoints",
        },
    ],
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(llm_router)
app.include_router(media_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
