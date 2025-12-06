"""
Model presets - optimal configurations for each image generation model.

Each preset contains recommended parameters that produce the best results
for the specific model architecture and training.
"""
from dataclasses import dataclass
from typing import TypedDict


class ImagePreset(TypedDict):
    """Image generation preset configuration"""
    model_id: str
    name: str
    description: str
    # Generation parameters
    num_inference_steps: int
    guidance_scale: float
    # Recommended dimensions
    width: int
    height: int
    # UI hints
    min_guidance: float
    max_guidance: float
    min_steps: int
    max_steps: int
    supports_negative_prompt: bool


class Image2ImagePreset(TypedDict):
    """Image-to-image preset configuration"""
    model_id: str
    name: str
    description: str
    # Generation parameters
    num_inference_steps: int
    guidance_scale: float
    strength: float
    # UI hints
    min_guidance: float
    max_guidance: float
    min_steps: int
    max_steps: int
    supports_negative_prompt: bool


# ============== Text-to-Image Presets ==============

IMAGE_PRESETS: dict[str, ImagePreset] = {
    "Tongyi-MAI/Z-Image-Turbo": {
        "model_id": "Tongyi-MAI/Z-Image-Turbo",
        "name": "Z-Image Turbo",
        "description": "Быстрая генерация высокого качества. 8 шагов, без CFG.",
        "num_inference_steps": 9,  # Results in 8 DiT forwards
        "guidance_scale": 0.0,  # Turbo models don't use CFG
        "width": 1024,
        "height": 1024,
        "min_guidance": 0.0,
        "max_guidance": 0.0,  # CFG должен быть 0
        "min_steps": 8,
        "max_steps": 12,
        "supports_negative_prompt": False,
    },
    "Heartsync/NSFW-Uncensored": {
        "model_id": "Heartsync/NSFW-Uncensored",
        "name": "NSFW Uncensored",
        "description": "SDXL модель без цензуры. Высокое качество, медленнее.",
        "num_inference_steps": 30,
        "guidance_scale": 7.0,
        "width": 1024,
        "height": 1024,
        "min_guidance": 1.0,
        "max_guidance": 15.0,
        "min_steps": 20,
        "max_steps": 50,
        "supports_negative_prompt": True,
    },
    "stabilityai/stable-diffusion-xl-base-1.0": {
        "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
        "name": "SDXL Base",
        "description": "Базовая SDXL модель. Универсальная, стабильная.",
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "width": 1024,
        "height": 1024,
        "min_guidance": 1.0,
        "max_guidance": 15.0,
        "min_steps": 20,
        "max_steps": 50,
        "supports_negative_prompt": True,
    },
}

# Default preset for unknown models (SDXL-like settings)
DEFAULT_IMAGE_PRESET: ImagePreset = {
    "model_id": "default",
    "name": "Default",
    "description": "Стандартные настройки для неизвестных моделей.",
    "num_inference_steps": 30,
    "guidance_scale": 7.5,
    "width": 1024,
    "height": 1024,
    "min_guidance": 0.0,
    "max_guidance": 20.0,
    "min_steps": 1,
    "max_steps": 50,
    "supports_negative_prompt": True,
}


# ============== Image-to-Image Presets ==============

IMAGE2IMAGE_PRESETS: dict[str, Image2ImagePreset] = {
    "stabilityai/stable-diffusion-xl-refiner-1.0": {
        "model_id": "stabilityai/stable-diffusion-xl-refiner-1.0",
        "name": "SDXL Refiner",
        "description": "Улучшает детали существующих изображений.",
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "strength": 0.3,  # Refiner works best with lower strength
        "min_guidance": 1.0,
        "max_guidance": 15.0,
        "min_steps": 15,
        "max_steps": 50,
        "supports_negative_prompt": True,
    },
    "stabilityai/stable-diffusion-xl-base-1.0": {
        "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
        "name": "SDXL Base",
        "description": "Трансформация изображений с SDXL.",
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "strength": 0.75,
        "min_guidance": 1.0,
        "max_guidance": 15.0,
        "min_steps": 20,
        "max_steps": 50,
        "supports_negative_prompt": True,
    },
    "Heartsync/NSFW-Uncensored": {
        "model_id": "Heartsync/NSFW-Uncensored",
        "name": "NSFW Uncensored",
        "description": "Трансформация без цензуры.",
        "num_inference_steps": 30,
        "guidance_scale": 7.0,
        "strength": 0.75,
        "min_guidance": 1.0,
        "max_guidance": 15.0,
        "min_steps": 20,
        "max_steps": 50,
        "supports_negative_prompt": True,
    },
}

DEFAULT_IMAGE2IMAGE_PRESET: Image2ImagePreset = {
    "model_id": "default",
    "name": "Default",
    "description": "Стандартные настройки для img2img.",
    "num_inference_steps": 30,
    "guidance_scale": 7.5,
    "strength": 0.75,
    "min_guidance": 0.0,
    "max_guidance": 20.0,
    "min_steps": 1,
    "max_steps": 100,
    "supports_negative_prompt": True,
}


def get_image_preset(model_id: str) -> ImagePreset:
    """Get preset for a text-to-image model."""
    return IMAGE_PRESETS.get(model_id, DEFAULT_IMAGE_PRESET)


def get_image2image_preset(model_id: str) -> Image2ImagePreset:
    """Get preset for an image-to-image model."""
    return IMAGE2IMAGE_PRESETS.get(model_id, DEFAULT_IMAGE2IMAGE_PRESET)


def get_all_image_presets() -> dict[str, ImagePreset]:
    """Get all available text-to-image presets."""
    return IMAGE_PRESETS.copy()


def get_all_image2image_presets() -> dict[str, Image2ImagePreset]:
    """Get all available image-to-image presets."""
    return IMAGE2IMAGE_PRESETS.copy()
