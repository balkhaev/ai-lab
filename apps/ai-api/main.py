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
import logging.config
import time
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html
from starlette.middleware.base import BaseHTTPMiddleware

from config import MODEL_IDS, REDIS_URL
from models.management import ModelType
from services.orchestrator import orchestrator
from services.queue import close_redis
from services.worker import start_worker, stop_worker
from routes import health_router, llm_router, media_router, models_router, queue_router

# Configure logging
LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "formatter": "default",
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stderr",
        },
    },
    "loggers": {
        "": {"handlers": ["default"], "level": "INFO"},
        "uvicorn.access": {"handlers": ["default"], "level": "ERROR", "propagate": False},
    },
}

logging.config.dictConfig(LOG_CONFIG)
logger = logging.getLogger("ai-api")


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs only errors (status >= 500)"""
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log only server errors (5xx)
        if response.status_code >= 500:
            logger.error(
                f'{request.client.host}:{request.client.port} - '
                f'"{request.method} {request.url.path}" {response.status_code} '
                f'({process_time:.3f}s)'
            )
        
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load models on startup, cleanup on shutdown"""
    # Disable uvicorn access logs completely (for CLI startup)
    uvicorn_access = logging.getLogger("uvicorn.access")
    uvicorn_access.handlers = []
    uvicorn_access.propagate = False
    
    logger.info("=" * 60)
    logger.info("AI API starting up...")
    logger.info("=" * 60)

    # Load LLM models using orchestrator
    llm_count = 0
    for model_id in MODEL_IDS:
        model_id = model_id.strip()
        if model_id:
            try:
                await orchestrator.load(model_id, ModelType.LLM)
                llm_count += 1
            except Exception as e:
                logger.error(f"Failed to load model {model_id}: {e}")

    # Start task queue worker
    logger.info("Starting task queue worker...")
    await start_worker()

    # Log initialization complete
    logger.info("=" * 60)
    logger.info("AI API initialization complete!")
    logger.info(f"  - LLM models loaded: {llm_count}")
    logger.info(f"  - Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
    if torch.cuda.is_available():
        logger.info(f"  - GPU: {torch.cuda.get_device_name(0)}")
        gpu_status = orchestrator.get_gpu_status()
        logger.info(f"  - GPU Memory: {gpu_status.total_mb / 1024:.1f} GB total, {gpu_status.free_mb / 1024:.1f} GB free")
    logger.info(f"  - Redis: {REDIS_URL}")
    logger.info("  - Swagger UI: http://0.0.0.0:8000/docs")
    logger.info("  - ReDoc: http://0.0.0.0:8000/redoc")
    logger.info("=" * 60)

    yield

    # Cleanup
    logger.info("AI API shutting down...")
    
    # Stop worker
    await stop_worker()
    
    # Close Redis
    await close_redis()
    
    # Unload all models via orchestrator
    for model in orchestrator.list_loaded():
        try:
            await orchestrator.unload(model.model_id)
        except Exception as e:
            logger.warning(f"Error unloading {model.model_id}: {e}")
    
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

### Model Management

The ModelOrchestrator automatically manages GPU memory:
- Smart LRU-based unloading when memory is needed
- Multiple models can coexist if memory permits
- Automatic switching between model types

### Authentication

Currently no authentication is required.
    """,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,  # Disable default ReDoc, using custom endpoint with stable CDN
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
        {
            "name": "Model Management",
            "description": "Dynamic model loading, unloading and switching endpoints",
        },
        {
            "name": "Task Queue",
            "description": "Async task queue management endpoints",
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

# Add error logging middleware (logs only 5xx errors)
app.add_middleware(ErrorLoggingMiddleware)


# Custom ReDoc endpoint with stable CDN version
@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return get_redoc_html(
        openapi_url=app.openapi_url or "/openapi.json",
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
    )

# Register routers
app.include_router(health_router)
app.include_router(llm_router)
app.include_router(media_router)
app.include_router(models_router)
app.include_router(queue_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_config=LOG_CONFIG)
