"""
Model management endpoints - dynamic loading and unloading
"""
import logging

from fastapi import APIRouter, HTTPException, BackgroundTasks

from models.management import (
    ModelType,
    ModelStatus,
    LoadModelRequest,
    LoadModelResponse,
    UnloadModelRequest,
    UnloadModelResponse,
    ModelsListResponse,
)
from services.model_manager import (
    load_model,
    unload_model,
    get_all_models,
    get_gpu_memory_info,
    get_disk_usage_info,
)
from state import model_status as model_status_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["Model Management"])


@router.get(
    "",
    response_model=ModelsListResponse,
    summary="List all models",
    description="Get information about all loaded and tracked models with GPU memory stats",
)
async def list_models():
    """List all models with their status"""
    models = get_all_models()
    gpu_total, gpu_used, gpu_free = get_gpu_memory_info()
    disk_total, disk_used, disk_free = get_disk_usage_info()

    return ModelsListResponse(
        models=models,
        gpu_memory_total_mb=gpu_total,
        gpu_memory_used_mb=gpu_used,
        gpu_memory_free_mb=gpu_free,
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

For media models (image/video), if another model of the same type is already loaded,
it will be automatically unloaded first.

For LLM models, multiple models can be loaded simultaneously (memory permitting).
    """,
)
async def load_model_endpoint(request: LoadModelRequest, background_tasks: BackgroundTasks):
    """Load a model dynamically"""
    logger.info(f"Request to load model: {request.model_id} (type: {request.model_type})")

    # Check if already loading
    status_info = model_status_store.get(request.model_id, {})
    if status_info.get("status") == ModelStatus.LOADING:
        raise HTTPException(
            status_code=409,
            detail=f"Model {request.model_id} is already being loaded"
        )

    success, message = await load_model(
        model_id=request.model_id,
        model_type=request.model_type,
        force=request.force,
    )

    if not success:
        raise HTTPException(status_code=500, detail=message)

    current_status = model_status_store.get(request.model_id, {}).get("status", ModelStatus.LOADED)

    return LoadModelResponse(
        model_id=request.model_id,
        status=current_status,
        message=message,
    )


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
    status_info = model_status_store.get(request.model_id, {})
    if status_info.get("status") == ModelStatus.UNLOADING:
        raise HTTPException(
            status_code=409,
            detail=f"Model {request.model_id} is already being unloaded"
        )

    success, message, freed_memory = await unload_model(
        model_id=request.model_id,
        model_type=request.model_type,
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return UnloadModelResponse(
        model_id=request.model_id,
        status=ModelStatus.NOT_LOADED,
        message=message,
        freed_memory_mb=freed_memory,
    )


@router.post(
    "/switch",
    response_model=LoadModelResponse,
    summary="Switch to a different model",
    description="""
Switch from the current model to a new one. This is a convenience endpoint that:
1. Unloads any existing model of the same type
2. Loads the new model

Useful for switching between different LLM or image generation models.
    """,
)
async def switch_model(request: LoadModelRequest):
    """Switch to a different model (unload current, load new)"""
    logger.info(f"Request to switch to model: {request.model_id} (type: {request.model_type})")

    # Force is always True for switch operation
    success, message = await load_model(
        model_id=request.model_id,
        model_type=request.model_type,
        force=True,
    )

    if not success:
        raise HTTPException(status_code=500, detail=message)

    current_status = model_status_store.get(request.model_id, {}).get("status", ModelStatus.LOADED)

    return LoadModelResponse(
        model_id=request.model_id,
        status=current_status,
        message=f"Switched to model {request.model_id}",
    )


@router.get(
    "/status/{model_id}",
    summary="Get model status",
    description="Get the current status of a specific model",
)
async def get_model_status(model_id: str):
    """Get status of a specific model"""
    status_info = model_status_store.get(model_id)

    if not status_info:
        raise HTTPException(
            status_code=404,
            detail=f"Model {model_id} not found or not tracked"
        )

    return {
        "model_id": model_id,
        "type": status_info.get("type"),
        "status": status_info.get("status"),
        "error": status_info.get("error"),
        "loaded_at": status_info.get("loaded_at"),
    }
