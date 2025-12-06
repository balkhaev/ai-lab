"""
Media generation endpoints - image and video
"""
import base64
import io
import time

import torch
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from PIL import Image

from config import (
    ENABLE_IMAGE,
    ENABLE_IMAGE2IMAGE,
    ENABLE_VIDEO,
    IMAGE_MODEL,
    IMAGE_MODELS,
    IMAGE2IMAGE_MODEL,
    IMAGE2IMAGE_MODELS,
    get_device,
)
from models.management import ModelType
from models.media import (
    ImageGenerationRequest,
    ImageGenerationResponse,
    Image2ImageResponse,
    VideoTaskResponse,
)
from models.queue import TaskType, TaskResponse
from presets import (
    get_image_preset,
    get_image2image_preset,
    get_all_image_presets,
    get_all_image2image_presets,
)
from services.orchestrator import orchestrator
from services.queue import create_task, get_task

router = APIRouter(prefix="/generate", tags=["Media Generation"])


@router.get(
    "/image/models",
    summary="Get available text2image models with presets",
    description="Returns list of available models with their optimal configurations",
)
async def get_image_models():
    """Get list of available text2image models with presets"""
    # Get current loaded image model from orchestrator
    image_model = orchestrator.get_by_type(ModelType.IMAGE)
    current_model = image_model.model_id if image_model else None
    
    # Get presets for all models
    all_presets = get_all_image_presets()
    presets = {model: all_presets.get(model, get_image_preset(model)) for model in IMAGE_MODELS}
    
    return {
        "models": IMAGE_MODELS,
        "current_model": current_model,
        "presets": presets,
    }


@router.get(
    "/image2image/models",
    summary="Get available image2image models with presets",
    description="Returns list of available models with their optimal configurations",
)
async def get_image2image_models():
    """Get list of available image2image models with presets"""
    # Get current loaded image2image model from orchestrator
    image2image_model = orchestrator.get_by_type(ModelType.IMAGE2IMAGE)
    current_model = image2image_model.model_id if image2image_model else None
    
    # Get presets for all models
    all_presets = get_all_image2image_presets()
    presets = {model: all_presets.get(model, get_image2image_preset(model)) for model in IMAGE2IMAGE_MODELS}
    
    return {
        "models": IMAGE2IMAGE_MODELS,
        "current_model": current_model,
        "presets": presets,
    }


@router.post(
    "/image",
    summary="Generate image",
    description="Generate an image from a text prompt using a diffusion model. Use async_mode=true to queue the task.",
)
async def generate_image(
    request: ImageGenerationRequest,
    async_mode: bool = Query(False, description="If true, queue task and return task_id instead of waiting"),
):
    """Generate image using diffusion model"""
    if not ENABLE_IMAGE:
        raise HTTPException(status_code=503, detail="Image generation is disabled")

    # Validate model if specified
    if request.model and request.model not in IMAGE_MODELS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid model. Available models: {IMAGE_MODELS}"
        )

    # Async mode: create task and return immediately
    if async_mode:
        task = await create_task(
            task_type=TaskType.IMAGE,
            params={
                "prompt": request.prompt,
                "negative_prompt": request.negative_prompt,
                "width": request.width,
                "height": request.height,
                "num_inference_steps": request.num_inference_steps,
                "guidance_scale": request.guidance_scale,
                "seed": request.seed,
                "model": request.model,
            },
        )
        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            progress=task.progress,
            error=task.error,
            created_at=task.created_at,
            updated_at=task.updated_at,
            user_id=task.user_id,
        )

    # Sync mode: generate immediately
    start_time = time.time()

    # Use orchestrator to ensure model is loaded
    model_id = request.model or IMAGE_MODEL
    loaded_model = await orchestrator.ensure_loaded(model_id, ModelType.IMAGE)
    pipe = loaded_model.instance

    seed = request.seed if request.seed is not None else torch.randint(0, 2**32, (1,)).item()
    generator = torch.Generator(device=get_device()).manual_seed(seed)

    result = pipe(
        prompt=request.prompt,
        negative_prompt=request.negative_prompt if request.negative_prompt else None,
        width=request.width,
        height=request.height,
        num_inference_steps=request.num_inference_steps,
        guidance_scale=request.guidance_scale,
        generator=generator,
    )

    image = result.images[0]

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    generation_time = time.time() - start_time

    return ImageGenerationResponse(
        image_base64=image_base64,
        seed=seed,
        generation_time=generation_time,
    )


@router.post(
    "/image2image",
    summary="Transform image with prompt",
    description="Transform an existing image based on a text prompt. Use async_mode=true to queue the task.",
)
async def generate_image2image(
    image: UploadFile = File(..., description="Input image to transform"),
    prompt: str = Form(..., description="Text prompt describing the transformation"),
    negative_prompt: str = Form(default="", description="Negative prompt"),
    strength: float = Form(default=0.75, description="Transformation strength (0.0-1.0)"),
    num_inference_steps: int = Form(default=30, description="Number of inference steps"),
    guidance_scale: float = Form(default=7.5, description="Guidance scale"),
    seed: int | None = Form(default=None, description="Random seed"),
    model: str | None = Form(default=None, description="Model to use (optional)"),
    async_mode: bool = Form(default=False, description="If true, queue task and return task_id"),
):
    """Transform image using image-to-image diffusion model"""
    if not ENABLE_IMAGE2IMAGE:
        raise HTTPException(status_code=503, detail="Image-to-image generation is disabled")

    # Validate model if specified
    if model and model not in IMAGE2IMAGE_MODELS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid model. Available models: {IMAGE2IMAGE_MODELS}"
        )

    # Read and process input image
    contents = await image.read()
    
    # Async mode: create task and return immediately
    if async_mode:
        # Encode image to base64 for storage
        image_base64 = base64.b64encode(contents).decode("utf-8")
        
        task = await create_task(
            task_type=TaskType.IMAGE2IMAGE,
            params={
                "prompt": prompt,
                "image_base64": image_base64,
                "negative_prompt": negative_prompt,
                "strength": strength,
                "num_inference_steps": num_inference_steps,
                "guidance_scale": guidance_scale,
                "seed": seed,
                "model": model,
            },
        )
        return TaskResponse(
            id=task.id,
            type=task.type,
            status=task.status,
            progress=task.progress,
            error=task.error,
            created_at=task.created_at,
            updated_at=task.updated_at,
            user_id=task.user_id,
        )

    # Sync mode: generate immediately
    start_time = time.time()
    
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    # Use orchestrator to ensure model is loaded
    model_id = model or IMAGE2IMAGE_MODEL
    loaded_model = await orchestrator.ensure_loaded(model_id, ModelType.IMAGE2IMAGE)
    pipe = loaded_model.instance

    actual_seed = seed if seed is not None else torch.randint(0, 2**32, (1,)).item()
    generator = torch.Generator(device=get_device()).manual_seed(actual_seed)

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt if negative_prompt else None,
        image=pil_image,
        strength=strength,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )

    output_image = result.images[0]

    buffer = io.BytesIO()
    output_image.save(buffer, format="PNG")
    result_image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    generation_time = time.time() - start_time

    return Image2ImageResponse(
        image_base64=result_image_base64,
        seed=actual_seed,
        generation_time=generation_time,
    )


@router.post(
    "/video",
    response_model=TaskResponse,
    summary="Start video generation",
    description="Start an async video generation task from an input image and text prompt. Uses Redis queue.",
)
async def generate_video(
    image: UploadFile = File(..., description="Input image for video generation"),
    prompt: str = Form(..., description="Text prompt describing the motion"),
    num_inference_steps: int = Form(default=50, description="Number of inference steps"),
    guidance_scale: float = Form(default=6.0, description="Guidance scale"),
    num_frames: int = Form(default=49, description="Number of frames to generate"),
    seed: int | None = Form(default=None, description="Random seed"),
):
    """Start video generation task using Redis queue"""
    if not ENABLE_VIDEO:
        raise HTTPException(status_code=503, detail="Video generation is disabled")

    contents = await image.read()
    
    # Encode image to base64 for storage in Redis
    image_base64 = base64.b64encode(contents).decode("utf-8")

    # Create task in Redis queue
    task = await create_task(
        task_type=TaskType.VIDEO,
        params={
            "prompt": prompt,
            "image_base64": image_base64,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "num_frames": num_frames,
            "seed": seed,
        },
    )

    return TaskResponse(
        id=task.id,
        type=task.type,
        status=task.status,
        progress=task.progress,
        error=task.error,
        created_at=task.created_at,
        updated_at=task.updated_at,
        user_id=task.user_id,
    )


@router.get(
    "/video/status/{task_id}",
    response_model=VideoTaskResponse,
    summary="Get video generation status",
    description="Check the status of a video generation task. Works with both old and new task IDs.",
)
async def get_video_status(task_id: str):
    """Get video generation task status from Redis"""
    task = await get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Return in legacy format for backwards compatibility
    result = task.result or {}
    return VideoTaskResponse(
        task_id=task_id,
        status=task.status.value,
        progress=task.progress,
        video_base64=result.get("video_base64"),
        error=task.error,
    )
