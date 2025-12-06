"""
Global application state

The ModelOrchestrator is the primary way to manage models.
Legacy variables are kept for backwards compatibility during transition.
"""
from typing import Any

# Import orchestrator singleton
from services.orchestrator import orchestrator

# Video generation tasks storage (used by async task queue)
video_tasks: dict[str, dict[str, Any]] = {}

# ============================================================
# LEGACY: These variables are deprecated and will be removed.
# Use orchestrator.get(), orchestrator.list_loaded() instead.
# ============================================================

# LLM engines storage (DEPRECATED - use orchestrator)
llm_engines: dict[str, Any] = {}

# Model metadata storage (DEPRECATED - use orchestrator)
model_info: dict[str, dict[str, Any]] = {}

# Media models storage (DEPRECATED - use orchestrator)
media_models: dict[str, Any] = {}

# Model status tracking (DEPRECATED - use orchestrator.get_status())
model_status: dict[str, dict[str, Any]] = {}

__all__ = [
    "orchestrator",
    "video_tasks",
    # Legacy exports
    "llm_engines",
    "model_info",
    "media_models",
    "model_status",
]
