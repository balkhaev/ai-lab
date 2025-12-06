"""
Task queue models for async job processing
"""
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TaskType(str, Enum):
    """Types of tasks that can be queued"""
    VIDEO = "video"
    IMAGE = "image"
    IMAGE2IMAGE = "image2image"
    LLM_COMPARE = "llm_compare"


class TaskStatus(str, Enum):
    """Status of a task in the queue"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskParams(BaseModel):
    """Base model for task parameters"""
    pass


class ImageTaskParams(TaskParams):
    """Parameters for image generation task"""
    prompt: str
    negative_prompt: str = ""
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 4
    guidance_scale: float = 3.5
    seed: int | None = None
    model: str | None = None


class Image2ImageTaskParams(TaskParams):
    """Parameters for image-to-image task"""
    prompt: str
    image_base64: str  # Input image as base64
    negative_prompt: str = ""
    strength: float = 0.75
    num_inference_steps: int = 30
    guidance_scale: float = 7.5
    seed: int | None = None
    model: str | None = None


class VideoTaskParams(TaskParams):
    """Parameters for video generation task"""
    prompt: str
    image_base64: str  # Input image as base64
    num_inference_steps: int = 50
    guidance_scale: float = 6.0
    num_frames: int = 49
    seed: int | None = None


class LLMCompareTaskParams(TaskParams):
    """Parameters for LLM comparison task"""
    models: list[str]
    messages: list[dict[str, str]]
    temperature: float = 0.7
    top_p: float = 0.95
    top_k: int = 40
    max_tokens: int = 2048


class Task(BaseModel):
    """Task model representing a job in the queue"""
    id: str
    type: TaskType
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    params: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    user_id: str | None = None


class CreateTaskRequest(BaseModel):
    """Request model for creating a new task"""
    type: TaskType
    params: dict[str, Any]
    user_id: str | None = None


class TaskResponse(BaseModel):
    """Response model for task status"""
    id: str
    type: TaskType
    status: TaskStatus
    progress: float
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    user_id: str | None = None


class TaskResultResponse(BaseModel):
    """Response model for task result (includes data)"""
    id: str
    type: TaskType
    status: TaskStatus
    result: dict[str, Any] | None = None
    error: str | None = None


class TaskListResponse(BaseModel):
    """Response model for list of tasks"""
    tasks: list[TaskResponse]
    total: int

