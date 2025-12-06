"""
Model management Pydantic models
"""
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class ModelType(str, Enum):
    """Type of model"""
    LLM = "llm"
    IMAGE = "image"
    IMAGE2IMAGE = "image2image"
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
    disk_total_gb: float | None = Field(default=None, description="Total disk space in GB")
    disk_used_gb: float | None = Field(default=None, description="Used disk space in GB")
    disk_free_gb: float | None = Field(default=None, description="Free disk space in GB")


# ==================== Cache Management Models ====================


class CachedModel(BaseModel):
    """Information about a cached model on disk"""
    repo_id: str = Field(..., description="HuggingFace repository ID (e.g., 'meta-llama/Llama-3.2-3B')")
    repo_type: str = Field(..., description="Repository type: model, dataset, or space")
    size_on_disk: int = Field(..., description="Size on disk in bytes")
    nb_files: int = Field(..., description="Number of cached files")
    last_accessed: datetime | None = Field(default=None, description="Last access timestamp")
    last_modified: datetime | None = Field(default=None, description="Last modification timestamp")
    revisions: list[str] = Field(default_factory=list, description="List of cached revision hashes")


class CacheListResponse(BaseModel):
    """Response with list of cached models"""
    models: list[CachedModel] = Field(default_factory=list, description="List of cached models")
    total_size_bytes: int = Field(default=0, description="Total cache size in bytes")
    cache_dir: str = Field(..., description="Path to HuggingFace cache directory")


class DownloadModelRequest(BaseModel):
    """Request to download a model to disk cache"""
    repo_id: str = Field(..., description="HuggingFace repository ID to download")
    model_type: ModelType = Field(..., description="Type of model (for proper download)")
    revision: str | None = Field(default=None, description="Specific revision to download (default: main)")


class DownloadModelResponse(BaseModel):
    """Response after downloading a model"""
    repo_id: str = Field(..., description="Repository ID")
    status: str = Field(..., description="Download status: completed, failed")
    message: str = Field(..., description="Status message")
    size_bytes: int | None = Field(default=None, description="Downloaded size in bytes")


class DeleteCacheResponse(BaseModel):
    """Response after deleting cached model"""
    repo_id: str = Field(..., description="Repository ID")
    status: str = Field(..., description="Delete status: deleted, not_found, failed")
    message: str = Field(..., description="Status message")
    freed_bytes: int | None = Field(default=None, description="Freed disk space in bytes")
