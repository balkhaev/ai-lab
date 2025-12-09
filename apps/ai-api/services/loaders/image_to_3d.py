"""
Image-to-3D model loaders using HunyuanWorld-Mirror

HunyuanWorld-Mirror is a versatile feed-forward model for comprehensive 3D geometric prediction.
It generates: point clouds, multi-view depths, camera parameters, surface normals, 3D Gaussians.
"""
import gc
import logging

import torch

from config import get_device, get_dtype

logger = logging.getLogger(__name__)


# Memory estimates for image-to-3D models (in MB)
IMAGE_TO_3D_MEMORY_ESTIMATES = {
    "hunyuanworld-mirror": 16_000,  # ~16GB for HunyuanWorld-Mirror
    "default": 16_000,  # Default estimate
}


def estimate_image_to_3d_memory(model_id: str) -> float:
    """
    Estimate GPU memory required for an image-to-3D model.
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Estimated memory in MB
    """
    model_id_lower = model_id.lower()
    
    if "hunyuanworld" in model_id_lower or "world-mirror" in model_id_lower:
        return IMAGE_TO_3D_MEMORY_ESTIMATES["hunyuanworld-mirror"]
    
    return IMAGE_TO_3D_MEMORY_ESTIMATES["default"]


def load_image_to_3d_pipeline(model_id: str) -> tuple[object, float]:
    """
    Load image-to-3D pipeline.
    
    Supports:
    - tencent/HunyuanWorld-Mirror: Universal 3D reconstruction
    
    Args:
        model_id: HuggingFace model ID
        
    Returns:
        Tuple of (Pipeline, estimated_memory_mb)
    """
    logger.info(f"Loading image-to-3D model: {model_id}")
    
    # HunyuanWorld-Mirror uses custom pipeline
    if "hunyuanworld" in model_id.lower() or "world-mirror" in model_id.lower():
        try:
            # Try to import HunyuanWorld-specific pipeline
            # The model uses a custom architecture, we need to load it properly
            from transformers import AutoModel, AutoProcessor
            
            # Load the model and processor
            model = AutoModel.from_pretrained(
                model_id,
                torch_dtype=get_dtype(),
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )
            
            processor = AutoProcessor.from_pretrained(
                model_id,
                trust_remote_code=True,
            )
            
            model = model.to(get_device())
            model.eval()
            
            # Return a wrapper dict containing both model and processor
            pipeline = {
                "model": model,
                "processor": processor,
                "model_id": model_id,
            }
            
            memory_estimate = estimate_image_to_3d_memory(model_id)
            logger.info(f"Image-to-3D model {model_id} loaded, estimated memory: {memory_estimate}MB")
            
            return pipeline, memory_estimate
            
        except ImportError as e:
            logger.error(f"Failed to import required modules for HunyuanWorld-Mirror: {e}")
            raise RuntimeError(
                f"HunyuanWorld-Mirror requires transformers with trust_remote_code support. "
                f"Original error: {e}"
            ) from e
        except Exception as e:
            logger.error(f"Failed to load HunyuanWorld-Mirror: {e}")
            raise RuntimeError(
                f"Failed to load HunyuanWorld-Mirror model. "
                f"Make sure you have the required dependencies. "
                f"Original error: {e}"
            ) from e
    else:
        raise ValueError(f"Unknown image-to-3D model: {model_id}")


def unload_image_to_3d_pipeline(pipe: dict) -> float:
    """
    Unload image-to-3D pipeline and free GPU memory.
    
    Args:
        pipe: Pipeline dict containing model and processor
        
    Returns:
        Estimated freed memory in MB
    """
    memory_before = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    
    try:
        # Move model to CPU first to free GPU memory
        if "model" in pipe and hasattr(pipe["model"], "to"):
            pipe["model"].to("cpu")
    except Exception as e:
        logger.warning(f"Error moving model to CPU: {e}")
    
    # Delete components
    if "model" in pipe:
        del pipe["model"]
    if "processor" in pipe:
        del pipe["processor"]
    
    # Force garbage collection
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    memory_after = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    freed_memory = max(0, memory_before - memory_after)
    
    logger.info(f"Image-to-3D pipeline unloaded, freed ~{freed_memory:.0f}MB")
    return freed_memory


def generate_3d(
    pipe: dict,
    image,
    output_format: str = "ply",
    camera_intrinsics: list | None = None,
    camera_pose: list | None = None,
    depth_map = None,
) -> dict:
    """
    Generate 3D representation from an image using HunyuanWorld-Mirror.
    
    Args:
        pipe: Pipeline dict containing model and processor
        image: PIL Image or path to image
        output_format: Output format - "ply" (point cloud), "depth", "normal", "gaussian"
        camera_intrinsics: Optional camera intrinsic matrix [[fx, 0, cx], [0, fy, cy], [0, 0, 1]]
        camera_pose: Optional camera pose matrix (4x4)
        depth_map: Optional depth map prior
        
    Returns:
        Dictionary with 3D outputs:
        - point_cloud: bytes (PLY format) if output_format includes "ply"
        - depth_map: numpy array if output_format includes "depth"
        - normal_map: numpy array if output_format includes "normal"
        - gaussians: dict with gaussian parameters if output_format includes "gaussian"
        - camera_params: estimated camera parameters
    """
    from PIL import Image
    import numpy as np
    
    model = pipe["model"]
    processor = pipe["processor"]
    
    # Prepare image
    if isinstance(image, str):
        image = Image.open(image).convert("RGB")
    elif not isinstance(image, Image.Image):
        raise ValueError("image must be a PIL Image or path string")
    
    # Prepare inputs
    inputs = processor(images=image, return_tensors="pt")
    inputs = {k: v.to(get_device()) for k, v in inputs.items()}
    
    # Add optional priors
    prior_kwargs = {}
    if camera_intrinsics is not None:
        prior_kwargs["camera_intrinsics"] = torch.tensor(camera_intrinsics, device=get_device())
    if camera_pose is not None:
        prior_kwargs["camera_pose"] = torch.tensor(camera_pose, device=get_device())
    if depth_map is not None:
        if isinstance(depth_map, np.ndarray):
            depth_map = torch.from_numpy(depth_map)
        prior_kwargs["depth"] = depth_map.to(get_device())
    
    # Generate 3D representation
    with torch.no_grad():
        outputs = model(**inputs, **prior_kwargs)
    
    result = {}
    
    # Extract point cloud
    if hasattr(outputs, "point_cloud") and outputs.point_cloud is not None:
        points = outputs.point_cloud.cpu().numpy()
        
        # Convert to PLY format
        ply_header = f"""ply
format ascii 1.0
element vertex {len(points)}
property float x
property float y
property float z
end_header
"""
        ply_data = ply_header + "\n".join([f"{p[0]} {p[1]} {p[2]}" for p in points])
        result["point_cloud_ply"] = ply_data.encode("utf-8")
        result["point_cloud_array"] = points.tolist()
    
    # Extract depth map
    if hasattr(outputs, "depth") and outputs.depth is not None:
        result["depth_map"] = outputs.depth.cpu().numpy().tolist()
    
    # Extract normal map
    if hasattr(outputs, "normal") and outputs.normal is not None:
        result["normal_map"] = outputs.normal.cpu().numpy().tolist()
    
    # Extract camera parameters
    if hasattr(outputs, "camera_params") and outputs.camera_params is not None:
        result["camera_params"] = {
            "intrinsics": outputs.camera_params.get("intrinsics", None),
            "pose": outputs.camera_params.get("pose", None),
        }
    
    # Extract 3D Gaussians
    if hasattr(outputs, "gaussians") and outputs.gaussians is not None:
        result["gaussians"] = {
            "means": outputs.gaussians.means.cpu().numpy().tolist() if hasattr(outputs.gaussians, "means") else None,
            "covariances": outputs.gaussians.covariances.cpu().numpy().tolist() if hasattr(outputs.gaussians, "covariances") else None,
            "colors": outputs.gaussians.colors.cpu().numpy().tolist() if hasattr(outputs.gaussians, "colors") else None,
            "opacities": outputs.gaussians.opacities.cpu().numpy().tolist() if hasattr(outputs.gaussians, "opacities") else None,
        }
    
    return result

