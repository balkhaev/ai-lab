"""
Media generation endpoints - image and video
"""
import asyncio
import base64
import io
import time
import uuid

import torch
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from PIL import Image

from config import ENABLE_IMAGE, ENABLE_VIDEO, get_device
from models.media import (
    ImageGenerationRequest,
    ImageGenerationResponse,
    VideoTaskResponse,
)
from services.media import load_image_model, process_video_task
from state import media_models, video_tasks

router = APIRouter(prefix="/generate", tags=["Media Generation"])


@router.post(
    "/image",
    response_model=ImageGenerationResponse,
    summary="Generate image",
    description="Generate an image from a text prompt using a diffusion model",
)
async def generate_image(request: ImageGenerationRequest):
    """Generate image using diffusion model"""
    if not ENABLE_IMAGE:
        raise HTTPException(status_code=503, detail="Image generation is disabled")

    start_time = time.time()

    # Lazy load model
    if "image" not in media_models:
        media_models["image"] = load_image_model()

    pipe = media_models["image"]

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
    "/video",
    response_model=VideoTaskResponse,
    summary="Start video generation",
    description="Start an async video generation task from an input image and text prompt",
)
async def generate_video(
    image: UploadFile = File(..., description="Input image for video generation"),
    prompt: str = Form(..., description="Text prompt describing the motion"),
    num_inference_steps: int = Form(default=50, description="Number of inference steps"),
    guidance_scale: float = Form(default=6.0, description="Guidance scale"),
    num_frames: int = Form(default=49, description="Number of frames to generate"),
    seed: int | None = Form(default=None, description="Random seed"),
):
    """Start video generation task"""
    if not ENABLE_VIDEO:
        raise HTTPException(status_code=503, detail="Video generation is disabled")

    contents = await image.read()
    pil_image = Image.open(io.BytesIO(contents)).convert("RGB")

    task_id = str(uuid.uuid4())
    video_tasks[task_id] = {
        "status": "pending",
        "progress": 0.0,
        "video_base64": None,
        "error": None,
    }

    # Start background task
    asyncio.create_task(process_video_task(
        task_id, pil_image, prompt,
        num_inference_steps, guidance_scale, num_frames, seed
    ))

    return VideoTaskResponse(
        task_id=task_id,
        status="pending",
        progress=0.0,
    )


@router.get(
    "/video/status/{task_id}",
    response_model=VideoTaskResponse,
    summary="Get video generation status",
    description="Check the status of a video generation task",
)
async def get_video_status(task_id: str):
    """Get video generation task status"""
    if task_id not in video_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = video_tasks[task_id]
    return VideoTaskResponse(
        task_id=task_id,
        status=task["status"],
        progress=task.get("progress"),
        video_base64=task.get("video_base64"),
        error=task.get("error"),
    )
