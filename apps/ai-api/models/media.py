"""
Media generation Pydantic models

Note: ai-api is a stateless service. It accepts all parameters explicitly.
Presets and defaults are managed by gateway.
"""
from pydantic import BaseModel, Field


class ImageGenerationRequest(BaseModel):
    """Image generation request"""
    prompt: str = Field(..., description="Text prompt for image generation")
    negative_prompt: str = Field(default="", description="Negative prompt")
    width: int = Field(default=1024, ge=256, le=2048, description="Image width")
    height: int = Field(default=1024, ge=256, le=2048, description="Image height")
    num_inference_steps: int = Field(default=30, ge=1, le=100, description="Number of inference steps")
    guidance_scale: float = Field(default=7.5, ge=0.0, le=20.0, description="Guidance scale")
    seed: int | None = Field(default=None, description="Random seed for reproducibility")
    model: str | None = Field(default=None, description="Model to use (uses default if not specified)")


class Image2ImageRequest(BaseModel):
    """Image-to-image generation request (form data - not used directly, for docs)"""
    prompt: str = Field(..., description="Text prompt for image transformation")
    negative_prompt: str = Field(default="", description="Negative prompt")
    strength: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        description="Transformation strength (0.0 = keep original, 1.0 = full transformation)"
    )
    num_inference_steps: int = Field(default=30, ge=1, le=100, description="Number of inference steps")
    guidance_scale: float = Field(default=7.5, ge=0.0, le=20.0, description="Guidance scale")
    seed: int | None = Field(default=None, description="Random seed for reproducibility")


class Image2ImageResponse(BaseModel):
    """Image-to-image generation response"""
    image_base64: str = Field(..., description="Base64 encoded PNG image")
    seed: int = Field(..., description="Seed used for generation")
    generation_time: float = Field(..., description="Generation time in seconds")


class ImageGenerationResponse(BaseModel):
    """Image generation response"""
    image_base64: str = Field(..., description="Base64 encoded PNG image")
    seed: int = Field(..., description="Seed used for generation")
    generation_time: float = Field(..., description="Generation time in seconds")


class VideoGenerationRequest(BaseModel):
    """Video generation request"""
    prompt: str = Field(..., description="Text prompt describing the motion")
    num_inference_steps: int = Field(default=50, ge=10, le=100, description="Number of inference steps")
    guidance_scale: float = Field(default=6.0, ge=1.0, le=20.0, description="Guidance scale")
    num_frames: int = Field(default=49, ge=16, le=81, description="Number of frames to generate")
    seed: int | None = Field(default=None, description="Random seed for reproducibility")


class VideoTaskResponse(BaseModel):
    """Video generation task status response"""
    task_id: str = Field(..., description="Unique task identifier")
    status: str = Field(..., description="Task status: pending, processing, completed, failed")
    progress: float | None = Field(default=None, description="Progress percentage (0-100)")
    video_base64: str | None = Field(default=None, description="Base64 encoded MP4 video (when completed)")
    error: str | None = Field(default=None, description="Error message (if failed)")


# ============== Image-to-3D Models ==============


class ImageTo3DRequest(BaseModel):
    """Image-to-3D generation request"""
    model: str | None = Field(default=None, description="Model to use (uses default if not specified)")
    # Optional camera priors
    camera_intrinsics: list[list[float]] | None = Field(
        default=None,
        description="Camera intrinsic matrix [[fx, 0, cx], [0, fy, cy], [0, 0, 1]]"
    )
    camera_pose: list[list[float]] | None = Field(
        default=None,
        description="Camera pose matrix (4x4)"
    )


class ImageTo3DResponse(BaseModel):
    """Image-to-3D generation response"""
    # Point cloud in PLY format (base64 encoded)
    point_cloud_ply_base64: str | None = Field(
        default=None,
        description="Point cloud in PLY format (base64 encoded)"
    )
    # Point cloud as array [[x, y, z], ...]
    point_cloud_array: list[list[float]] | None = Field(
        default=None,
        description="Point cloud as array of [x, y, z] points"
    )
    # Depth map
    depth_map: list[list[float]] | None = Field(
        default=None,
        description="Depth map as 2D array"
    )
    # Normal map
    normal_map: list[list[list[float]]] | None = Field(
        default=None,
        description="Normal map as 3D array (H x W x 3)"
    )
    # Estimated camera parameters
    camera_params: dict | None = Field(
        default=None,
        description="Estimated camera intrinsics and pose"
    )
    # 3D Gaussians (for gaussian splatting)
    gaussians: dict | None = Field(
        default=None,
        description="3D Gaussian parameters (means, covariances, colors, opacities)"
    )
    # Generation metadata
    generation_time: float = Field(..., description="Generation time in seconds")


class ImageTo3DTaskResponse(BaseModel):
    """Image-to-3D task status response"""
    task_id: str = Field(..., description="Unique task identifier")
    status: str = Field(..., description="Task status: pending, processing, completed, failed")
    progress: float | None = Field(default=None, description="Progress percentage (0-100)")
    result: ImageTo3DResponse | None = Field(default=None, description="Result when completed")
    error: str | None = Field(default=None, description="Error message (if failed)")
