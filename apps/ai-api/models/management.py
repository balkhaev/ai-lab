"""
Model management Pydantic models
"""
from enum import Enum
from pydantic import BaseModel, Field


class ModelType(str, Enum):
    """Type of model"""
    LLM = "llm"
    IMAGE = "image"
    VIDEO = "video"


class ModelStatus(str, Enum):
    """Model loading status"""
    NOT_LOADED = "not_loaded"
    LOADING = "loading"
    LOADED = "loaded"
    UNLOADING = "unloading"
    ERROR = "error"


class ModelInfo(BaseModel):
    """Information about a model"""
    model_id: str = Field(..., description="Model identifier (HuggingFace ID or name)")
    model_type: ModelType = Field(..., description="Type of model (llm, image, video)")
    status: ModelStatus = Field(..., description="Current loading status")
    name: str = Field(..., description="Short model name")
    loaded_at: str | None = Field(default=None, description="ISO timestamp when model was loaded")
    memory_usage_mb: float | None = Field(default=None, description="Estimated GPU memory usage in MB")
    error: str | None = Field(default=None, description="Error message if loading failed")


class LoadModelRequest(BaseModel):
    """Request to load a model"""
    model_id: str = Field(..., description="HuggingFace model ID or path")
    model_type: ModelType = Field(..., description="Type of model to load")
    force: bool = Field(default=False, description="Force reload if already loaded")


class LoadModelResponse(BaseModel):
    """Response after loading a model"""
    model_id: str = Field(..., description="Model identifier")
    status: ModelStatus = Field(..., description="Current status")
    message: str = Field(..., description="Status message")


class UnloadModelRequest(BaseModel):
    """Request to unload a model"""
    model_id: str = Field(..., description="Model identifier to unload")
    model_type: ModelType = Field(..., description="Type of model to unload")


class UnloadModelResponse(BaseModel):
    """Response after unloading a model"""
    model_id: str = Field(..., description="Model identifier")
    status: ModelStatus = Field(..., description="Current status")
    message: str = Field(..., description="Status message")
    freed_memory_mb: float | None = Field(default=None, description="Freed GPU memory in MB")


class ModelsListResponse(BaseModel):
    """Response with list of all models"""
    models: list[ModelInfo] = Field(default_factory=list, description="List of all models")
    gpu_memory_total_mb: float | None = Field(default=None, description="Total GPU memory in MB")
    gpu_memory_used_mb: float | None = Field(default=None, description="Used GPU memory in MB")
    gpu_memory_free_mb: float | None = Field(default=None, description="Free GPU memory in MB")
