"""
Model management endpoints - dynamic loading and unloading
"""
import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models.management import (
    ModelType,
    ModelStatus,
    ModelInfo,
    LoadModelRequest,
    LoadModelResponse,
    UnloadModelRequest,
    UnloadModelResponse,
    ModelsListResponse,
    CacheListResponse,
    DownloadModelRequest,
    DownloadModelResponse,
    DeleteCacheResponse,
)
from services.orchestrator import orchestrator
from services import cache as cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["Model Management"])


def _get_model_short_name(model_id: str) -> str:
    """Extract short name from model ID"""
    return model_id.split("/")[-1]


def _loaded_model_to_info(loaded_model) -> ModelInfo:
    """Convert LoadedModel to ModelInfo for API response"""
    status_info = orchestrator.get_status(loaded_model.model_id) or {}
    return ModelInfo(
        model_id=loaded_model.model_id,
        model_type=loaded_model.model_type,
        status=status_info.get("status", ModelStatus.LOADED),
        name=_get_model_short_name(loaded_model.model_id),
        loaded_at=loaded_model.loaded_at.isoformat() if loaded_model.loaded_at else None,
        memory_usage_mb=loaded_model.memory_mb,
        error=status_info.get("error"),
    )


@router.get(
    "",
    response_model=ModelsListResponse,
    summary="List all models",
    description="Get information about all loaded and tracked models with GPU memory stats",
)
async def list_models():
    """List all models with their status"""
    # Get loaded models
    loaded_models = orchestrator.list_loaded()
    models = [_loaded_model_to_info(m) for m in loaded_models]
    
    # Add models with non-loaded statuses (loading, error, unloading)
    for model_id, status_info in orchestrator.get_all_statuses().items():
        status = status_info.get("status")
        if status in [ModelStatus.LOADING, ModelStatus.ERROR, ModelStatus.UNLOADING]:
            # Check if not already in loaded list
            if not any(m.model_id == model_id for m in models):
                models.append(ModelInfo(
                    model_id=model_id,
                    model_type=status_info.get("type", ModelType.LLM),
                    status=status,
                    name=_get_model_short_name(model_id),
                    loaded_at=status_info.get("loaded_at"),
                    memory_usage_mb=None,
                    error=status_info.get("error"),
                ))
    
    # Get GPU and disk info
    gpu = orchestrator.get_gpu_status()
    disk_total, disk_used, disk_free = orchestrator.get_disk_usage()

    return ModelsListResponse(
        models=models,
        gpu_memory_total_mb=gpu.total_mb,
        gpu_memory_used_mb=gpu.used_mb,
        gpu_memory_free_mb=gpu.free_mb,
        disk_total_gb=disk_total,
        disk_used_gb=disk_used,
        disk_free_gb=disk_free,
    )


@router.post(
    "/load",
    response_model=LoadModelResponse,
    summary="Load a model",
    description="""
Load a model into GPU memory. 

The orchestrator automatically manages GPU memory:
- If memory is insufficient, least recently used models are unloaded
- Multiple models can coexist if memory permits

Use force=true to reload an already loaded model.
    """,
)
async def load_model_endpoint(request: LoadModelRequest):
    """Load a model dynamically"""
    logger.info(f"Request to load model: {request.model_id} (type: {request.model_type})")

    # Check if already loading
    status_info = orchestrator.get_status(request.model_id)
    if status_info and status_info.get("status") == ModelStatus.LOADING:
        raise HTTPException(
            status_code=409,
            detail=f"Model {request.model_id} is already being loaded"
        )

    try:
        loaded_model = await orchestrator.load(
            model_id=request.model_id,
            model_type=request.model_type,
            force=request.force,
        )
        
        return LoadModelResponse(
            model_id=request.model_id,
            status=ModelStatus.LOADED,
            message=f"Model {request.model_id} loaded successfully",
        )
        
    except Exception as e:
        logger.error(f"Failed to load model {request.model_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/unload",
    response_model=UnloadModelResponse,
    summary="Unload a model",
    description="Unload a model from GPU memory to free up resources",
)
async def unload_model_endpoint(request: UnloadModelRequest):
    """Unload a model dynamically"""
    logger.info(f"Request to unload model: {request.model_id} (type: {request.model_type})")

    # Check if already unloading
    status_info = orchestrator.get_status(request.model_id)
    if status_info and status_info.get("status") == ModelStatus.UNLOADING:
        raise HTTPException(
            status_code=409,
            detail=f"Model {request.model_id} is already being unloaded"
        )
    
    # Check if model is loaded
    if not orchestrator.is_loaded(request.model_id):
        raise HTTPException(
            status_code=400,
            detail=f"Model {request.model_id} is not loaded"
        )

    try:
        freed_memory = await orchestrator.unload(request.model_id)
        
        return UnloadModelResponse(
            model_id=request.model_id,
            status=ModelStatus.NOT_LOADED,
            message=f"Model {request.model_id} unloaded successfully",
            freed_memory_mb=freed_memory,
        )
        
    except Exception as e:
        logger.error(f"Failed to unload model {request.model_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/switch",
    response_model=LoadModelResponse,
    summary="Switch to a different model",
    description="""
Switch from the current model to a new one. This is a convenience endpoint that:
1. Automatically handles memory management (unloads LRU models if needed)
2. Loads the new model

Useful for switching between different LLM or image generation models.
    """,
)
async def switch_model(request: LoadModelRequest):
    """Switch to a different model (unload current, load new)"""
    logger.info(f"Request to switch to model: {request.model_id} (type: {request.model_type})")

    try:
        # Force is always True for switch operation
        loaded_model = await orchestrator.load(
            model_id=request.model_id,
            model_type=request.model_type,
            force=True,
        )
        
        return LoadModelResponse(
            model_id=request.model_id,
            status=ModelStatus.LOADED,
            message=f"Switched to model {request.model_id}",
        )
        
    except Exception as e:
        logger.error(f"Failed to switch to model {request.model_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/status/{model_id}",
    summary="Get model status",
    description="Get the current status of a specific model",
)
async def get_model_status(model_id: str):
    """Get status of a specific model"""
    # First check if loaded
    loaded_model = orchestrator.get(model_id)
    if loaded_model:
        status_info = orchestrator.get_status(model_id) or {}
        return {
            "model_id": model_id,
            "type": loaded_model.model_type,
            "status": status_info.get("status", ModelStatus.LOADED),
            "error": status_info.get("error"),
            "loaded_at": loaded_model.loaded_at.isoformat() if loaded_model.loaded_at else None,
            "memory_usage_mb": loaded_model.memory_mb,
        }
    
    # Check status store for non-loaded models
    status_info = orchestrator.get_status(model_id)
    if status_info:
        return {
            "model_id": model_id,
            "type": status_info.get("type"),
            "status": status_info.get("status"),
            "error": status_info.get("error"),
            "loaded_at": status_info.get("loaded_at"),
            "memory_usage_mb": None,
        }

    raise HTTPException(
        status_code=404,
        detail=f"Model {model_id} not found or not tracked"
    )


# ==================== Cache Management Endpoints ====================


@router.get(
    "/cache",
    response_model=CacheListResponse,
    summary="List cached models",
    description="Get list of all models downloaded to disk cache (HuggingFace hub cache)",
)
async def list_cached_models():
    """List all models in the HuggingFace cache"""
    loop = asyncio.get_event_loop()
    models, total_size, cache_dir = await loop.run_in_executor(
        None, cache_service.scan_cache
    )
    
    return CacheListResponse(
        models=models,
        total_size_bytes=total_size,
        cache_dir=cache_dir,
    )


@router.post(
    "/cache/download",
    response_model=DownloadModelResponse,
    summary="Download model to cache",
    description="""
Download a model from HuggingFace to disk cache without loading it into GPU memory.

This is useful for pre-downloading models to avoid download time during load operations.
    """,
)
async def download_model_to_cache(request: DownloadModelRequest):
    """Download a model to cache without loading"""
    logger.info(f"Request to download model to cache: {request.repo_id}")
    
    try:
        loop = asyncio.get_event_loop()
        local_path, size = await loop.run_in_executor(
            None,
            cache_service.download_model,
            request.repo_id,
            request.model_type,
            request.revision,
        )
        
        return DownloadModelResponse(
            repo_id=request.repo_id,
            status="completed",
            message=f"Model downloaded to {local_path}",
            size_bytes=size,
        )
        
    except Exception as e:
        logger.error(f"Failed to download model {request.repo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/cache/{repo_id:path}",
    response_model=DeleteCacheResponse,
    summary="Delete cached model",
    description="Delete a model from the disk cache to free up space",
)
async def delete_cached_model(repo_id: str):
    """Delete a model from cache"""
    logger.info(f"Request to delete cached model: {repo_id}")
    
    loop = asyncio.get_event_loop()
    success, freed_bytes = await loop.run_in_executor(
        None, cache_service.delete_model, repo_id
    )
    
    if not success:
        return DeleteCacheResponse(
            repo_id=repo_id,
            status="not_found",
            message=f"Model {repo_id} not found in cache",
            freed_bytes=None,
        )
    
    return DeleteCacheResponse(
        repo_id=repo_id,
        status="deleted",
        message=f"Model {repo_id} deleted from cache",
        freed_bytes=freed_bytes,
    )
