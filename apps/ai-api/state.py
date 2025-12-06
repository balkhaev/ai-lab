"""
Global application state
"""
from typing import Any

# LLM engines storage
llm_engines: dict[str, Any] = {}

# Model metadata storage
model_info: dict[str, dict[str, Any]] = {}

# Media models storage (lazy loaded)
media_models: dict[str, Any] = {}

# Video generation tasks storage
video_tasks: dict[str, dict[str, Any]] = {}

# Model status tracking (for dynamic loading/unloading)
model_status: dict[str, dict[str, Any]] = {}
