"""
Model loaders - modular loading functions for different model types
"""
from services.loaders.llm import load_llm, unload_llm, estimate_llm_memory
from services.loaders.image import (
    load_image_pipeline,
    load_image2image_pipeline,
    unload_image_pipeline,
    estimate_image_memory,
    is_longcat_model,
)
from services.loaders.video import (
    load_video_pipeline,
    unload_video_pipeline,
    detect_video_family,
    VideoModelFamily,
    estimate_video_memory,
)
from services.loaders.image_to_3d import (
    load_image_to_3d_pipeline,
    unload_image_to_3d_pipeline,
    estimate_image_to_3d_memory,
    generate_3d,
)

__all__ = [
    # LLM
    "load_llm",
    "unload_llm",
    "estimate_llm_memory",
    # Image
    "load_image_pipeline",
    "load_image2image_pipeline",
    "unload_image_pipeline",
    "estimate_image_memory",
    "is_longcat_model",
    # Video
    "load_video_pipeline",
    "unload_video_pipeline",
    "detect_video_family",
    "VideoModelFamily",
    "estimate_video_memory",
    # Image-to-3D
    "load_image_to_3d_pipeline",
    "unload_image_to_3d_pipeline",
    "estimate_image_to_3d_memory",
    "generate_3d",
]

