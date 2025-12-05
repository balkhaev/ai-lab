"""
Media generation service - image and video generation
"""
import base64
import logging

import torch
from PIL import Image

from config import (
    IMAGE_MODEL,
    VIDEO_MODEL,
    OUTPUT_DIR,
    get_device,
    get_dtype,
)
from state import media_models, video_tasks

logger = logging.getLogger(__name__)


def load_image_model():
    """Load image generation model"""
    from diffusers import DiffusionPipeline

    logger.info(f"Loading image model: {IMAGE_MODEL}")
    pipe = DiffusionPipeline.from_pretrained(
        IMAGE_MODEL,
        torch_dtype=get_dtype(),
        trust_remote_code=True,
    )
    pipe.to(get_device())
    if get_device() == "cuda":
        pipe.enable_model_cpu_offload()
    logger.info("Image model loaded successfully")
    return pipe


def load_video_model():
    """Load video generation model"""
    from diffusers import CogVideoXImageToVideoPipeline

    logger.info(f"Loading video model: {VIDEO_MODEL}")
    pipe = CogVideoXImageToVideoPipeline.from_pretrained(
        VIDEO_MODEL,
        torch_dtype=get_dtype(),
    )
    pipe.to(get_device())
    if get_device() == "cuda":
        pipe.enable_model_cpu_offload()
    logger.info("Video model loaded successfully")
    return pipe


async def process_video_task(
    task_id: str,
    image: Image.Image,
    prompt: str,
    num_inference_steps: int,
    guidance_scale: float,
    num_frames: int,
    seed: int | None
):
    """Background task for video generation"""
    import imageio
    import numpy as np

    logger.info(f"Starting video generation task: {task_id}")
    video_tasks[task_id]["status"] = "processing"

    try:
        # Lazy load model
        if "video" not in media_models:
            media_models["video"] = load_video_model()

        pipe = media_models["video"]

        actual_seed = seed if seed is not None else torch.randint(0, 2**32, (1,)).item()
        generator = torch.Generator(device=get_device()).manual_seed(actual_seed)

        # Generate video
        result = pipe(
            prompt=prompt,
            image=image,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            num_frames=num_frames,
            generator=generator,
        )

        # Export frames to video
        frames = result.frames[0]

        output_path = OUTPUT_DIR / f"{task_id}.mp4"
        writer = imageio.get_writer(str(output_path), fps=8, codec="libx264")

        for frame in frames:
            if isinstance(frame, Image.Image):
                frame = frame.convert("RGB")
                frame = np.array(frame)
            writer.append_data(frame)

        writer.close()

        # Read and encode video
        with open(output_path, "rb") as f:
            video_base64 = base64.b64encode(f.read()).decode("utf-8")

        video_tasks[task_id]["status"] = "completed"
        video_tasks[task_id]["video_base64"] = video_base64
        video_tasks[task_id]["progress"] = 100.0

        logger.info(f"Video generation task completed: {task_id}")

    except Exception as e:
        logger.error(f"Video generation task failed: {task_id}, error: {e}")
        video_tasks[task_id]["status"] = "failed"
        video_tasks[task_id]["error"] = str(e)
