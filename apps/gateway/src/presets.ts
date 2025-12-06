/**
 * Model presets - optimal configurations for each image generation model.
 *
 * Gateway manages presets and applies them before sending requests to ai-api.
 * ai-api is a stateless service that accepts all parameters explicitly.
 */

export type ImagePreset = {
  model_id: string;
  name: string;
  description: string;
  // Generation parameters
  num_inference_steps: number;
  guidance_scale: number;
  // Recommended dimensions
  width: number;
  height: number;
  // UI hints
  min_guidance: number;
  max_guidance: number;
  min_steps: number;
  max_steps: number;
  supports_negative_prompt: boolean;
};

export type Image2ImagePreset = {
  model_id: string;
  name: string;
  description: string;
  // Generation parameters
  num_inference_steps: number;
  guidance_scale: number;
  strength: number;
  // UI hints
  min_guidance: number;
  max_guidance: number;
  min_steps: number;
  max_steps: number;
  supports_negative_prompt: boolean;
};

// ============== Text-to-Image Presets ==============

export const IMAGE_PRESETS: Record<string, ImagePreset> = {
  "Tongyi-MAI/Z-Image-Turbo": {
    model_id: "Tongyi-MAI/Z-Image-Turbo",
    name: "Z-Image Turbo",
    description: "Быстрая генерация высокого качества. 8 шагов, без CFG.",
    num_inference_steps: 9, // Results in 8 DiT forwards
    guidance_scale: 0.0, // Turbo models don't use CFG
    width: 1024,
    height: 1024,
    min_guidance: 0.0,
    max_guidance: 0.0, // CFG должен быть 0
    min_steps: 8,
    max_steps: 12,
    supports_negative_prompt: false,
  },
  "Heartsync/NSFW-Uncensored": {
    model_id: "Heartsync/NSFW-Uncensored",
    name: "NSFW Uncensored",
    description: "SDXL модель без цензуры. Высокое качество, медленнее.",
    num_inference_steps: 30,
    guidance_scale: 7.0,
    width: 1024,
    height: 1024,
    min_guidance: 1.0,
    max_guidance: 15.0,
    min_steps: 20,
    max_steps: 50,
    supports_negative_prompt: true,
  },
  "stabilityai/stable-diffusion-xl-base-1.0": {
    model_id: "stabilityai/stable-diffusion-xl-base-1.0",
    name: "SDXL Base",
    description: "Базовая SDXL модель. Универсальная, стабильная.",
    num_inference_steps: 30,
    guidance_scale: 7.5,
    width: 1024,
    height: 1024,
    min_guidance: 1.0,
    max_guidance: 15.0,
    min_steps: 20,
    max_steps: 50,
    supports_negative_prompt: true,
  },
};

// Default preset for unknown models (SDXL-like settings)
export const DEFAULT_IMAGE_PRESET: ImagePreset = {
  model_id: "default",
  name: "Default",
  description: "Стандартные настройки для неизвестных моделей.",
  num_inference_steps: 30,
  guidance_scale: 7.5,
  width: 1024,
  height: 1024,
  min_guidance: 0.0,
  max_guidance: 20.0,
  min_steps: 1,
  max_steps: 50,
  supports_negative_prompt: true,
};

// ============== Image-to-Image Presets ==============

export const IMAGE2IMAGE_PRESETS: Record<string, Image2ImagePreset> = {
  "stabilityai/stable-diffusion-xl-refiner-1.0": {
    model_id: "stabilityai/stable-diffusion-xl-refiner-1.0",
    name: "SDXL Refiner",
    description: "Улучшает детали существующих изображений.",
    num_inference_steps: 30,
    guidance_scale: 7.5,
    strength: 0.3, // Refiner works best with lower strength
    min_guidance: 1.0,
    max_guidance: 15.0,
    min_steps: 15,
    max_steps: 50,
    supports_negative_prompt: true,
  },
  "stabilityai/stable-diffusion-xl-base-1.0": {
    model_id: "stabilityai/stable-diffusion-xl-base-1.0",
    name: "SDXL Base",
    description: "Трансформация изображений с SDXL.",
    num_inference_steps: 30,
    guidance_scale: 7.5,
    strength: 0.75,
    min_guidance: 1.0,
    max_guidance: 15.0,
    min_steps: 20,
    max_steps: 50,
    supports_negative_prompt: true,
  },
  "Heartsync/NSFW-Uncensored": {
    model_id: "Heartsync/NSFW-Uncensored",
    name: "NSFW Uncensored",
    description: "Трансформация без цензуры.",
    num_inference_steps: 30,
    guidance_scale: 7.0,
    strength: 0.75,
    min_guidance: 1.0,
    max_guidance: 15.0,
    min_steps: 20,
    max_steps: 50,
    supports_negative_prompt: true,
  },
};

export const DEFAULT_IMAGE2IMAGE_PRESET: Image2ImagePreset = {
  model_id: "default",
  name: "Default",
  description: "Стандартные настройки для img2img.",
  num_inference_steps: 30,
  guidance_scale: 7.5,
  strength: 0.75,
  min_guidance: 0.0,
  max_guidance: 20.0,
  min_steps: 1,
  max_steps: 100,
  supports_negative_prompt: true,
};

// ============== Helper Functions ==============

export function getImagePreset(modelId: string): ImagePreset {
  return IMAGE_PRESETS[modelId] ?? DEFAULT_IMAGE_PRESET;
}

export function getImage2ImagePreset(modelId: string): Image2ImagePreset {
  return IMAGE2IMAGE_PRESETS[modelId] ?? DEFAULT_IMAGE2IMAGE_PRESET;
}

export function getAllImagePresets(): Record<string, ImagePreset> {
  return { ...IMAGE_PRESETS };
}

export function getAllImage2ImagePresets(): Record<string, Image2ImagePreset> {
  return { ...IMAGE2IMAGE_PRESETS };
}
