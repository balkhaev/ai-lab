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

import json
import io
import base64
import uuid
import time
import asyncio
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from PIL import Image
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

# ============================================================================
# Configuration
# ============================================================================

# Device configuration - use functions to avoid early CUDA initialization
def get_device():
    return "cuda" if torch.cuda.is_available() else "cpu"

def get_dtype():
    return torch.bfloat16 if torch.cuda.is_available() else torch.float32

# LLM configuration
MODEL_IDS = os.environ.get(
    "MODEL_IDS",
    "NousResearch/Hermes-4-14B-FP8"
).split(",")
TENSOR_PARALLEL_SIZE = int(os.environ.get("TENSOR_PARALLEL_SIZE", "1"))
GPU_MEMORY_UTILIZATION = float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.95"))
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "8192"))

# Media configuration
IMAGE_MODEL = os.environ.get("IMAGE_MODEL", "Tongyi-MAI/Z-Image-Turbo")
VIDEO_MODEL = os.environ.get("VIDEO_MODEL", "FX-FeiHou/wan2.2-Remix")
ENABLE_IMAGE = os.environ.get("ENABLE_IMAGE", "true").lower() == "true"
ENABLE_VIDEO = os.environ.get("ENABLE_VIDEO", "true").lower() == "true"

OUTPUT_DIR = Path("./outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

# Global storage
llm_engines: dict = {}
model_info: dict = {}
media_models: dict = {}
video_tasks: dict = {}


# ============================================================================
# Pydantic Models
# ============================================================================

# LLM Models
class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: system, user, or assistant")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    model: str = Field(..., description="Model name to use")
    messages: list[ChatMessage] = Field(..., description="Chat messages")
    stream: bool = Field(default=True, description="Stream response")
    temperature: float = Field(default=0.7, ge=0, le=2)
    top_p: float = Field(default=0.95, ge=0, le=1)
    top_k: int = Field(default=40, ge=1)
    max_tokens: int = Field(default=2048, ge=1, le=8192)


class CompareRequest(BaseModel):
    models: list[str] = Field(..., min_length=1, max_length=5)
    messages: list[ChatMessage] = Field(..., description="Chat messages")
    temperature: float = Field(default=0.7, ge=0, le=2)
    top_p: float = Field(default=0.95, ge=0, le=1)
    top_k: int = Field(default=40, ge=1)
    max_tokens: int = Field(default=2048, ge=1, le=8192)


# Image Models
class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt for image generation")
    negative_prompt: str = Field(default="", description="Negative prompt")
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    num_inference_steps: int = Field(default=4, ge=1, le=50)
    guidance_scale: float = Field(default=3.5, ge=1.0, le=20.0)
    seed: int | None = Field(default=None)


class ImageGenerationResponse(BaseModel):
    image_base64: str
    seed: int
    generation_time: float


# Video Models
class VideoGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text prompt describing the motion")
    num_inference_steps: int = Field(default=50, ge=10, le=100)
    guidance_scale: float = Field(default=6.0, ge=1.0, le=20.0)
    num_frames: int = Field(default=49, ge=16, le=81)
    seed: int | None = Field(default=None)


class VideoTaskResponse(BaseModel):
    task_id: str
    status: str  # pending, processing, completed, failed
    progress: float | None = None
    video_base64: str | None = None
    error: str | None = None


# ============================================================================
# LLM Functions
# ============================================================================

def format_chat_prompt(messages: list[ChatMessage], model_id: str) -> str:
    """Format messages into ChatML format for Hermes models"""
    formatted = ""
    for msg in messages:
        formatted += f"<|im_start|>{msg.role}\n{msg.content}<|im_end|>\n"
    formatted += "<|im_start|>assistant\n"
    return formatted


async def load_llm_model(model_id: str):
    """Load a model using vLLM AsyncEngine"""
    from vllm import SamplingParams
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.engine.async_llm_engine import AsyncLLMEngine

    print(f"[LLM] Loading model: {model_id}")

    engine_args = AsyncEngineArgs(
        model=model_id,
        tensor_parallel_size=TENSOR_PARALLEL_SIZE,
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        max_model_len=MAX_MODEL_LEN,
        trust_remote_code=True,
        dtype="auto",
    )

    engine = AsyncLLMEngine.from_engine_args(engine_args)

    model_info[model_id] = {
        "name": model_id.split("/")[-1],
        "size": 0,
        "loaded": True,
    }

    print(f"[LLM] Model {model_id} loaded successfully!")
    return engine


async def generate_llm_stream(
    engine,
    prompt: str,
    sampling_params,
    model_name: str,
) -> AsyncGenerator[str, None]:
    """Generate streaming LLM response"""
    request_id = str(uuid.uuid4())

    results_generator = engine.generate(prompt, sampling_params, request_id)

    full_text = ""
    async for request_output in results_generator:
        if request_output.outputs:
            output = request_output.outputs[0]
            new_text = output.text[len(full_text):]
            full_text = output.text

            if new_text:
                data = json.dumps({
                    "message": {"content": new_text},
                    "model": model_name,
                    "done": False
                })
                yield f"data: {data}\n\n"

    data = json.dumps({
        "message": {"content": ""},
        "model": model_name,
        "done": True
    })
    yield f"data: {data}\n\n"


# ============================================================================
# Media Functions
# ============================================================================

def load_image_model():
    """Load image generation model"""
    from diffusers import FluxPipeline

    print(f"[Media] Loading image model: {IMAGE_MODEL}")
    pipe = FluxPipeline.from_pretrained(
        IMAGE_MODEL,
        torch_dtype=get_dtype(),
    )
    pipe.to(get_device())
    if get_device() == "cuda":
        pipe.enable_model_cpu_offload()
    print(f"[Media] Image model loaded!")
    return pipe


def load_video_model():
    """Load video generation model"""
    from diffusers import CogVideoXImageToVideoPipeline

    print(f"[Media] Loading video model: {VIDEO_MODEL}")
    pipe = CogVideoXImageToVideoPipeline.from_pretrained(
        VIDEO_MODEL,
        torch_dtype=get_dtype(),
    )
    pipe.to(get_device())
    if get_device() == "cuda":
        pipe.enable_model_cpu_offload()
    print(f"[Media] Video model loaded!")
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

    video_tasks[task_id]["status"] = "processing"

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


# ============================================================================
# App Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup"""
    # Load LLM models
    for model_id in MODEL_IDS:
        model_id = model_id.strip()
        if model_id:
            llm_engines[model_id] = await load_llm_model(model_id)

    # Media models are loaded lazily on first request
    yield

    # Cleanup
    llm_engines.clear()
    model_info.clear()
    media_models.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="AI API",
    description="Unified API for LLM inference and media generation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health & Info Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": get_device(),
        "cuda_available": torch.cuda.is_available(),
        "llm_models": list(llm_engines.keys()),
        "media_models": list(media_models.keys()),
        "features": {
            "llm": len(llm_engines) > 0,
            "image": ENABLE_IMAGE,
            "video": ENABLE_VIDEO,
        }
    }


# ============================================================================
# LLM Endpoints
# ============================================================================

@app.get("/api/tags")
async def list_models():
    """List available LLM models"""
    models = []
    for model_id, info in model_info.items():
        models.append({
            "name": info["name"],
            "size": info["size"],
            "modified_at": "",
        })
    return {"models": models}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Chat with a model"""
    from vllm import SamplingParams

    # Find engine by model name
    engine = None
    model_id = None

    for mid, eng in llm_engines.items():
        if request.model in mid or request.model == model_info.get(mid, {}).get("name"):
            engine = eng
            model_id = mid
            break

    if not engine:
        raise HTTPException(status_code=404, detail=f"Model {request.model} not found")

    prompt = format_chat_prompt(request.messages, model_id)

    sampling_params = SamplingParams(
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
        max_tokens=request.max_tokens,
    )

    if request.stream:
        return StreamingResponse(
            generate_llm_stream(engine, prompt, sampling_params, request.model),
            media_type="text/event-stream",
        )

    # Non-streaming response
    request_id = str(uuid.uuid4())
    start_time = time.time()

    results = []
    async for output in engine.generate(prompt, sampling_params, request_id):
        results.append(output)

    final_output = results[-1] if results else None

    if not final_output or not final_output.outputs:
        raise HTTPException(status_code=500, detail="Generation failed")

    generated_text = final_output.outputs[0].text
    total_duration = int((time.time() - start_time) * 1e9)

    return {
        "model": request.model,
        "message": {
            "role": "assistant",
            "content": generated_text,
        },
        "done": True,
        "total_duration": total_duration,
        "eval_count": len(generated_text.split()),
    }


@app.post("/api/compare")
async def compare_models(request: CompareRequest):
    """Compare multiple models (streaming)"""
    from vllm import SamplingParams

    async def generate_comparison():
        start_time = time.time()

        prompt = format_chat_prompt(request.messages, "")

        sampling_params = SamplingParams(
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            max_tokens=request.max_tokens,
        )

        for model_name in request.models:
            engine = None

            for mid, eng in llm_engines.items():
                if model_name in mid or model_name == model_info.get(mid, {}).get("name"):
                    engine = eng
                    break

            if not engine:
                data = json.dumps({
                    "model": model_name,
                    "error": "Model not found",
                    "done": True
                })
                yield f"event: model_error\ndata: {data}\n\n"
                continue

            model_start_time = time.time()
            request_id = str(uuid.uuid4())
            full_content = ""

            async for request_output in engine.generate(prompt, sampling_params, request_id):
                if request_output.outputs:
                    output = request_output.outputs[0]
                    new_text = output.text[len(full_content):]
                    full_content = output.text

                    if new_text:
                        data = json.dumps({
                            "model": model_name,
                            "content": new_text,
                            "done": False
                        })
                        yield f"event: chunk\ndata: {data}\n\n"

            duration = int((time.time() - model_start_time) * 1000)
            data = json.dumps({
                "model": model_name,
                "fullContent": full_content,
                "duration": duration
            })
            yield f"event: model_done\ndata: {data}\n\n"

        total_duration = int((time.time() - start_time) * 1000)
        data = json.dumps({"totalDuration": total_duration})
        yield f"event: all_done\ndata: {data}\n\n"

    return StreamingResponse(
        generate_comparison(),
        media_type="text/event-stream",
    )


# ============================================================================
# Image Generation Endpoints
# ============================================================================

@app.post("/generate/image", response_model=ImageGenerationResponse)
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


# ============================================================================
# Video Generation Endpoints
# ============================================================================

@app.post("/generate/video", response_model=VideoTaskResponse)
async def generate_video(
    image: UploadFile = File(..., description="Input image for video generation"),
    prompt: str = Form(..., description="Text prompt describing the motion"),
    num_inference_steps: int = Form(default=50),
    guidance_scale: float = Form(default=6.0),
    num_frames: int = Form(default=49),
    seed: int | None = Form(default=None),
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


@app.get("/generate/video/status/{task_id}", response_model=VideoTaskResponse)
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


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

