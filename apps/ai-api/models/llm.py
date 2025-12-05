"""
LLM-related Pydantic models
"""
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="Role: system, user, or assistant")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Chat completion request"""
    model: str = Field(..., description="Model name to use")
    messages: list[ChatMessage] = Field(..., description="Chat messages")
    stream: bool = Field(default=True, description="Stream response")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Sampling temperature")
    top_p: float = Field(default=0.95, ge=0, le=1, description="Top-p sampling")
    top_k: int = Field(default=40, ge=1, description="Top-k sampling")
    max_tokens: int = Field(default=2048, ge=1, le=8192, description="Maximum tokens to generate")


class CompareRequest(BaseModel):
    """Request to compare multiple models"""
    models: list[str] = Field(..., min_length=1, max_length=5, description="List of model names to compare")
    messages: list[ChatMessage] = Field(..., description="Chat messages")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Sampling temperature")
    top_p: float = Field(default=0.95, ge=0, le=1, description="Top-p sampling")
    top_k: int = Field(default=40, ge=1, description="Top-k sampling")
    max_tokens: int = Field(default=2048, ge=1, le=8192, description="Maximum tokens to generate")
