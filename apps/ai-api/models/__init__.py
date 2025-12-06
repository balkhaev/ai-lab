"""
Pydantic models for API requests and responses
"""
from models.llm import ChatMessage, ChatRequest, CompareRequest
from models.media import (
    ImageGenerationRequest,
    ImageGenerationResponse,
    VideoGenerationRequest,
    VideoTaskResponse,
)
from models.management import (
    ModelType,
    ModelStatus,
    ModelInfo,
    LoadModelRequest,
    LoadModelResponse,
    UnloadModelRequest,
    UnloadModelResponse,
    ModelsListResponse,
)
from models.queue import (
    TaskType,
    TaskStatus,
    Task,
    CreateTaskRequest,
    TaskResponse,
    TaskResultResponse,
    TaskListResponse,
    ImageTaskParams,
    Image2ImageTaskParams,
    VideoTaskParams,
    LLMCompareTaskParams,
)

__all__ = [
    "ChatMessage",
    "ChatRequest",
    "CompareRequest",
    "ImageGenerationRequest",
    "ImageGenerationResponse",
    "VideoGenerationRequest",
    "VideoTaskResponse",
    "ModelType",
    "ModelStatus",
    "ModelInfo",
    "LoadModelRequest",
    "LoadModelResponse",
    "UnloadModelRequest",
    "UnloadModelResponse",
    "ModelsListResponse",
    "TaskType",
    "TaskStatus",
    "Task",
    "CreateTaskRequest",
    "TaskResponse",
    "TaskResultResponse",
    "TaskListResponse",
    "ImageTaskParams",
    "Image2ImageTaskParams",
    "VideoTaskParams",
    "LLMCompareTaskParams",
]
