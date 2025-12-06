"""
LLM-related Pydantic models
"""
from typing import Literal
from pydantic import BaseModel, Field


class TextContent(BaseModel):
    """Text content part"""
    type: Literal["text"] = "text"
    text: str = Field(..., description="Text content")


class ImageUrl(BaseModel):
    """Image URL or base64 data"""
    url: str = Field(..., description="Image URL or data:image/...;base64,... format")


class ImageContent(BaseModel):
    """Image content part"""
    type: Literal["image_url"] = "image_url"
    image_url: ImageUrl = Field(..., description="Image URL object")


class ChatMessage(BaseModel):
    """Single chat message with optional multimodal content"""
    role: str = Field(..., description="Role: system, user, or assistant")
    content: str | list[TextContent | ImageContent] = Field(..., description="Message content - string or array of content parts")


class ChatRequest(BaseModel):
    """Chat completion request"""
    model: str = Field(..., description="Model name to use")
    messages: list[ChatMessage] = Field(..., description="Chat messages")
    stream: bool = Field(default=True, description="Stream response")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Sampling temperature")
    top_p: float = Field(default=0.95, ge=0, le=1, description="Top-p sampling")
    top_k: int = Field(default=40, ge=1, description="Top-k sampling")
    max_tokens: int = Field(default=2048, ge=1, le=8192, description="Maximum tokens to generate")
    prompt_format: str | None = Field(default=None, description="Prompt format: chatml, mistral, llama2. Auto-detected if not provided.")


class CompareRequest(BaseModel):
    """Request to compare multiple models"""
    models: list[str] = Field(..., min_length=1, max_length=5, description="List of model names to compare")
    messages: list[ChatMessage] = Field(..., description="Chat messages")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Sampling temperature")
    top_p: float = Field(default=0.95, ge=0, le=1, description="Top-p sampling")
    top_k: int = Field(default=40, ge=1, description="Top-k sampling")
    max_tokens: int = Field(default=2048, ge=1, le=8192, description="Maximum tokens to generate")
    prompt_format: str | None = Field(default=None, description="Prompt format: chatml, mistral, llama2. Auto-detected if not provided.")
