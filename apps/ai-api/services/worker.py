"""
Task Worker Service - Background processing of queued tasks
"""
import asyncio
import base64
import io
import logging
from typing import Callable, Coroutine

import torch
from PIL import Image

from config import get_device, VIDEO_MODEL, IMAGE_MODEL, IMAGE2IMAGE_MODEL
from models.management import ModelType
from models.queue import TaskStatus, TaskType
from services.orchestrator import orchestrator
from services.queue import (
    get_next_pending_task,
    get_task,
    update_task,
    get_processing_count,
)

logger = logging.getLogger(__name__)

# Concurrency limits per task type
CONCURRENCY_LIMITS: dict[TaskType, int] = {
    TaskType.VIDEO: 1,      # Video is very memory intensive
    TaskType.IMAGE: 2,      # Images are relatively fast
    TaskType.IMAGE2IMAGE: 2,
    TaskType.LLM_COMPARE: 1,  # LLM comparison can be heavy
}

# Track currently processing tasks per type
_processing_counts: dict[TaskType, int] = {
    TaskType.VIDEO: 0,
    TaskType.IMAGE: 0,
    TaskType.IMAGE2IMAGE: 0,
    TaskType.LLM_COMPARE: 0,
}

# Worker running flag
_worker_running = False


async def process_image_task(task_id: str, params: dict) -> dict:
    """Process an image generation task"""
    logger.info(f"Processing image task {task_id}")
    
    # Extract parameters
    prompt = params["prompt"]
    negative_prompt = params.get("negative_prompt", "")
    width = params.get("width", 1024)
    height = params.get("height", 1024)
    num_inference_steps = params.get("num_inference_steps", 9)  # 9 for Z-Image-Turbo
    guidance_scale = params.get("guidance_scale", 0.0)  # 0.0 for Z-Image-Turbo
    seed = params.get("seed")
    model = params.get("model") or IMAGE_MODEL
    
    # Load model using orchestrator
    loaded_model = await orchestrator.ensure_loaded(model, ModelType.IMAGE)
    pipe = loaded_model.instance
    
    # Generate
    actual_seed = seed if seed is not None else torch.randint(0, 2**32, (1,)).item()
    generator = torch.Generator(device=get_device()).manual_seed(actual_seed)
    
    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt if negative_prompt else None,
        width=width,
        height=height,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )
    
    image = result.images[0]
    
    # Encode to base64
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    return {
        "image_base64": image_base64,
        "seed": actual_seed,
    }


async def process_image2image_task(task_id: str, params: dict) -> dict:
    """Process an image-to-image task"""
    logger.info(f"Processing image2image task {task_id}")
    
    # Extract parameters
    prompt = params["prompt"]
    image_base64 = params["image_base64"]
    negative_prompt = params.get("negative_prompt", "")
    strength = params.get("strength", 0.75)
    num_inference_steps = params.get("num_inference_steps", 30)
    guidance_scale = params.get("guidance_scale", 7.5)
    seed = params.get("seed")
    model = params.get("model") or IMAGE2IMAGE_MODEL
    
    # Decode input image
    image_data = base64.b64decode(image_base64)
    pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")
    
    # Load model using orchestrator
    loaded_model = await orchestrator.ensure_loaded(model, ModelType.IMAGE2IMAGE)
    pipe = loaded_model.instance
    
    # Generate
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
    
    # Encode to base64
    buffer = io.BytesIO()
    output_image.save(buffer, format="PNG")
    image_base64_result = base64.b64encode(buffer.getvalue()).decode("utf-8")
    
    return {
        "image_base64": image_base64_result,
        "seed": actual_seed,
    }


async def process_video_task(task_id: str, params: dict) -> dict:
    """Process a video generation task"""
    import imageio
    import numpy as np
    from services.loaders.video import VideoModelFamily
    from services.media import (
        _generate_video_cogvideox,
        _generate_video_hunyuan,
        _generate_video_wan,
        _generate_video_ltx,
        _generate_video_wan_rapid,
    )
    from config import OUTPUT_DIR
    
    logger.info(f"Processing video task {task_id}")
    
    # Extract parameters
    prompt = params["prompt"]
    image_base64 = params["image_base64"]
    num_inference_steps = params.get("num_inference_steps", 50)
    guidance_scale = params.get("guidance_scale", 6.0)
    num_frames = params.get("num_frames", 49)
    seed = params.get("seed")
    
    # Decode input image
    image_data = base64.b64decode(image_base64)
    pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")
    
    # Update progress
    await update_task(task_id, progress=10.0)
    
    # Load model using orchestrator
    loaded_model = await orchestrator.ensure_loaded(VIDEO_MODEL, ModelType.VIDEO)
    pipe = loaded_model.instance
    model_family = loaded_model.metadata.get("video_family", VideoModelFamily.UNKNOWN.value)
    
    await update_task(task_id, progress=20.0)
    
    # Generate
    actual_seed = seed if seed is not None else torch.randint(0, 2**32, (1,)).item()
    generator = torch.Generator(device=get_device()).manual_seed(actual_seed)
    
    # Generate video using appropriate method for model family
    if model_family == VideoModelFamily.COGVIDEOX.value:
        result = _generate_video_cogvideox(
            pipe, prompt, pil_image, num_inference_steps, guidance_scale, num_frames, generator
        )
    elif model_family == VideoModelFamily.HUNYUAN.value:
        result = _generate_video_hunyuan(
            pipe, prompt, pil_image, num_inference_steps, guidance_scale, num_frames, generator
        )
    elif model_family == VideoModelFamily.WAN.value:
        result = _generate_video_wan(
            pipe, prompt, pil_image, num_inference_steps, guidance_scale, num_frames, generator
        )
    elif model_family == VideoModelFamily.WAN_RAPID.value:
        result = _generate_video_wan_rapid(
            pipe, prompt, pil_image, num_inference_steps, guidance_scale, num_frames, generator
        )
    elif model_family == VideoModelFamily.LTX.value:
        result = _generate_video_ltx(
            pipe, prompt, pil_image, num_inference_steps, guidance_scale, num_frames, generator
        )
    else:
        # Generic fallback
        result = pipe(
            prompt=prompt,
            image=pil_image,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            num_frames=num_frames,
            generator=generator,
        )
    
    await update_task(task_id, progress=80.0)
    
    # Export frames to video
    frames = result.frames[0]
    
    # Determine FPS based on model family
    fps = 8
    if model_family == VideoModelFamily.HUNYUAN.value:
        fps = 30
    elif model_family in (VideoModelFamily.WAN.value, VideoModelFamily.WAN_RAPID.value):
        fps = 24
    elif model_family == VideoModelFamily.LTX.value:
        fps = 30
    
    output_path = OUTPUT_DIR / f"{task_id}.mp4"
    writer = imageio.get_writer(str(output_path), fps=fps, codec="libx264")
    
    for frame in frames:
        if isinstance(frame, Image.Image):
            frame = frame.convert("RGB")
            frame = np.array(frame)
        writer.append_data(frame)
    
    writer.close()
    
    await update_task(task_id, progress=90.0)
    
    # Read and encode video
    with open(output_path, "rb") as f:
        video_base64 = base64.b64encode(f.read()).decode("utf-8")
    
    return {
        "video_base64": video_base64,
        "seed": actual_seed,
    }


async def process_llm_compare_task(task_id: str, params: dict) -> dict:
    """Process an LLM comparison task"""
    from vllm import SamplingParams
    from services.llm import format_chat_prompt
    
    logger.info(f"Processing LLM compare task {task_id}")
    
    # Extract parameters
    models = params["models"]
    messages = params["messages"]
    temperature = params.get("temperature", 0.7)
    top_p = params.get("top_p", 0.95)
    top_k = params.get("top_k", 40)
    max_tokens = params.get("max_tokens", 2048)
    
    prompt = format_chat_prompt(messages, "")
    
    sampling_params = SamplingParams(
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        max_tokens=max_tokens,
    )
    
    results = {}
    total_models = len(models)
    
    for idx, model_name in enumerate(models):
        # Find the loaded LLM model
        engine = None
        for loaded_model in orchestrator.list_loaded():
            if loaded_model.model_type == ModelType.LLM:
                if model_name in loaded_model.model_id or model_name == loaded_model.model_id.split("/")[-1]:
                    engine = loaded_model.instance
                    break
        
        if not engine:
            results[model_name] = {"error": "Model not found"}
            continue
        
        import uuid
        request_id = str(uuid.uuid4())
        full_content = ""
        
        async for request_output in engine.generate(prompt, sampling_params, request_id):
            if request_output.outputs:
                full_content = request_output.outputs[0].text
        
        results[model_name] = {
            "content": full_content,
        }
        
        # Update progress
        progress = ((idx + 1) / total_models) * 100
        await update_task(task_id, progress=progress)
    
    return {"responses": results}


# Task type to processor mapping
TASK_PROCESSORS: dict[TaskType, Callable[[str, dict], Coroutine]] = {
    TaskType.IMAGE: process_image_task,
    TaskType.IMAGE2IMAGE: process_image2image_task,
    TaskType.VIDEO: process_video_task,
    TaskType.LLM_COMPARE: process_llm_compare_task,
}


async def process_task(task_id: str) -> None:
    """Process a single task"""
    task = await get_task(task_id)
    if not task:
        logger.error(f"Task {task_id} not found")
        return
    
    task_type = task.type
    
    # Check if we can process this type (concurrency limit)
    if _processing_counts[task_type] >= CONCURRENCY_LIMITS[task_type]:
        logger.debug(f"Concurrency limit reached for {task_type.value}, requeueing")
        # Re-add to queue (at the end)
        from services.queue import get_redis, PENDING_QUEUE_KEY
        r = await get_redis()
        await r.rpush(PENDING_QUEUE_KEY, task_id)
        return
    
    _processing_counts[task_type] += 1
    
    try:
        # Update status to processing
        await update_task(task_id, status=TaskStatus.PROCESSING)
        
        # Get processor for task type
        processor = TASK_PROCESSORS.get(task_type)
        if not processor:
            raise ValueError(f"Unknown task type: {task_type}")
        
        # Process task
        result = await processor(task_id, task.params)
        
        # Update with result
        await update_task(
            task_id,
            status=TaskStatus.COMPLETED,
            progress=100.0,
            result=result,
        )
        
        logger.info(f"Task {task_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        await update_task(
            task_id,
            status=TaskStatus.FAILED,
            error=str(e),
        )
    finally:
        _processing_counts[task_type] -= 1


async def worker_loop() -> None:
    """Main worker loop - polls queue and processes tasks"""
    global _worker_running
    _worker_running = True
    
    logger.info("Task worker started")
    
    while _worker_running:
        try:
            # Get next pending task
            task_id = await get_next_pending_task()
            
            if task_id:
                # Process task in background
                asyncio.create_task(process_task(task_id))
            else:
                # No tasks, wait a bit
                await asyncio.sleep(0.5)
                
        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            await asyncio.sleep(1)
    
    logger.info("Task worker stopped")


async def start_worker() -> None:
    """Start the background worker"""
    asyncio.create_task(worker_loop())


async def stop_worker() -> None:
    """Stop the background worker"""
    global _worker_running
    _worker_running = False
