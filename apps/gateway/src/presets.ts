/**
 * Model presets - optimal configurations for each model.
 *
 * Gateway manages presets and applies them before sending requests to ai-api.
 * ai-api is a stateless service that accepts all parameters explicitly.
 */

// Re-export types from shared
export type {
  Image2ImagePreset,
  ImagePreset,
  ImageTo3DPreset,
  LLMPreset,
  VideoPreset,
} from "@ai-lab/shared/types";

import type {
  Image2ImagePreset,
  ImagePreset,
  ImageTo3DPreset,
  LLMPreset,
  VideoPreset,
} from "@ai-lab/shared/types";

// ============== LLM Presets ==============

export const LLM_PRESETS: Record<string, LLMPreset> = {
  "MarinaraSpaghetti/NemoMix-Unleashed-12B": {
    model_id: "MarinaraSpaghetti/NemoMix-Unleashed-12B",
    name: "NemoMix Unleashed 12B",
    description:
      "Mistral Nemo 12B мерж для RP и сторителлинга. Температура 1.0-1.25.",
    prompt_format: "mistral",
    temperature: 1.0,
    top_p: 0.95,
    top_k: 40,
    max_tokens: 4096,
    min_temperature: 0.5,
    max_temperature: 2.0,
    supports_system_prompt: true,
    supports_vision: false,
  },
  "DavidAU/Llama-3.2-8X3B-MOE-Dark-Champion-Instruct-uncensored-abliterated-18.4B":
    {
      model_id:
        "DavidAU/Llama-3.2-8X3B-MOE-Dark-Champion-Instruct-uncensored-abliterated-18.4B",
      name: "Dark Champion 18B MOE",
      description:
        "Llama 3.2 MOE (8x3B). Uncensored, для творческого письма и RP. 128k контекст.",
      prompt_format: "llama3",
      temperature: 0.8,
      top_p: 0.95,
      top_k: 40,
      max_tokens: 4096,
      min_temperature: 0.1,
      max_temperature: 2.0, // Model supports up to 5, but 2 is reasonable UI max
      supports_system_prompt: true,
      supports_vision: false,
    },
  "dphn/dolphin-2.9.3-mistral-nemo-12b": {
    model_id: "dphn/dolphin-2.9.3-mistral-nemo-12b",
    name: "Dolphin 2.9.3 Nemo 12B",
    description:
      "Uncensored модель от Eric Hartford. Function calling, coding, ChatML. 128k контекст.",
    prompt_format: "chatml",
    temperature: 0.7,
    top_p: 0.95,
    top_k: 40,
    max_tokens: 4096,
    min_temperature: 0.0,
    max_temperature: 2.0,
    supports_system_prompt: true,
    supports_vision: false,
  },
  "huihui-ai/Qwen3-VL-8B-Instruct-abliterated": {
    model_id: "huihui-ai/Qwen3-VL-8B-Instruct-abliterated",
    name: "Qwen3 VL 8B Abliterated",
    description:
      "Vision-Language модель без цензуры. Понимает изображения. ChatML формат.",
    prompt_format: "chatml",
    temperature: 0.7,
    top_p: 0.95,
    top_k: 40,
    max_tokens: 4096,
    min_temperature: 0.0,
    max_temperature: 2.0,
    supports_system_prompt: true,
    supports_vision: true,
  },
};

export const DEFAULT_LLM_PRESET: LLMPreset = {
  model_id: "default",
  name: "Default",
  description: "Стандартные настройки для неизвестных моделей.",
  prompt_format: "chatml",
  temperature: 0.7,
  top_p: 0.95,
  top_k: 40,
  max_tokens: 2048,
  min_temperature: 0.0,
  max_temperature: 2.0,
  supports_system_prompt: true,
  supports_vision: false,
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
  "lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1": {
    model_id: "lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1",
    name: "Flux NSFW Uncensored",
    description:
      "Flux LoRA модель без цензуры. Высокое качество, ~16GB VRAM. Базируется на FLUX.1-dev.",
    num_inference_steps: 28,
    guidance_scale: 3.5,
    width: 1024,
    height: 1024,
    min_guidance: 1.0,
    max_guidance: 7.0,
    min_steps: 20,
    max_steps: 50,
    supports_negative_prompt: false, // Flux не использует negative prompt
    base_model_id: "black-forest-labs/FLUX.1-dev",
    lora_repo: "lustlyai/Flux_Lustly.ai_Uncensored_nsfw_v1",
    lora_scale: 1.0,
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
  "meituan-longcat/LongCat-Image-Edit": {
    model_id: "meituan-longcat/LongCat-Image-Edit",
    name: "LongCat Image Edit",
    description:
      "SOTA модель редактирования изображений. Билингвальная (CN/EN), поддерживает глобальное/локальное редактирование, текст, и reference-guided editing. ~19GB VRAM.",
    num_inference_steps: 50,
    guidance_scale: 4.5,
    strength: 1.0, // LongCat не использует strength, но поле обязательно
    min_guidance: 1.0,
    max_guidance: 10.0,
    min_steps: 20,
    max_steps: 100,
    supports_negative_prompt: true,
  },
  "nsfw-undress": {
    model_id: "nsfw-undress",
    name: "NSFW Undress",
    description:
      "NSFW модель с LoRA для генерации изображений раздевающихся девушек. Базируется на Heartsync/NSFW-Uncensored + sexy LoRA. ~8GB VRAM.",
    num_inference_steps: 30,
    guidance_scale: 7.0,
    strength: 0.65, // Оптимально для undress эффекта
    min_guidance: 3.0,
    max_guidance: 12.0,
    min_steps: 20,
    max_steps: 50,
    supports_negative_prompt: true,
    lora_repo: "ntc-ai/SDXL-LoRA-slider.sexy",
    lora_weight_name: "sexy.safetensors",
    lora_scale: 1.5,
    lora_trigger_word: "sexy",
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

// ============== Image-to-3D Presets ==============

export const IMAGE_TO_3D_PRESETS: Record<string, ImageTo3DPreset> = {
  "tencent/HunyuanWorld-Mirror": {
    model_id: "tencent/HunyuanWorld-Mirror",
    name: "HunyuanWorld-Mirror",
    description:
      "Универсальная модель для 3D-реконструкции. Генерирует point cloud, depth, normals, 3D Gaussians.",
    outputs: {
      point_cloud: true,
      depth_map: true,
      normal_map: true,
      gaussians: true,
      camera_params: true,
    },
    vram_gb: 16,
    supports_camera_intrinsics: true,
    supports_camera_pose: true,
    supports_depth_prior: true,
  },
};

export const DEFAULT_IMAGE_TO_3D_PRESET: ImageTo3DPreset = {
  model_id: "default",
  name: "Default",
  description: "Стандартные настройки для image-to-3D моделей.",
  outputs: {
    point_cloud: true,
    depth_map: true,
    normal_map: false,
    gaussians: false,
    camera_params: true,
  },
  vram_gb: 16,
  supports_camera_intrinsics: false,
  supports_camera_pose: false,
  supports_depth_prior: false,
};

// ============== Video Presets ==============

export const VIDEO_PRESETS: Record<string, VideoPreset> = {
  "Phr00t/WAN2.2-14B-Rapid-AllInOne": {
    model_id: "Phr00t/WAN2.2-14B-Rapid-AllInOne",
    name: "WAN Rapid MEGA",
    description:
      "FP8, 4 шага, работает на 8GB VRAM! Поддерживает T2V, I2V и VACE. Рекомендуется для быстрой генерации.",
    num_inference_steps: 4,
    guidance_scale: 1.0,
    num_frames: 49,
    fps: 24,
    vram_gb: 8,
    is_rapid: true,
    supports_t2v: true,
    supports_i2v: true,
    min_steps: 1,
    max_steps: 10,
    min_guidance: 1,
    max_guidance: 5,
  },
  "Lightricks/LTX-Video": {
    model_id: "Lightricks/LTX-Video",
    name: "LTX-Video",
    description:
      "Быстрая модель с real-time возможностями. 30 FPS, ~16GB VRAM.",
    num_inference_steps: 30,
    guidance_scale: 6.0,
    num_frames: 49,
    fps: 30,
    vram_gb: 16,
    is_rapid: false,
    supports_t2v: true,
    supports_i2v: true,
    min_steps: 10,
    max_steps: 50,
    min_guidance: 1,
    max_guidance: 15,
  },
  "THUDM/CogVideoX-5b-I2V": {
    model_id: "THUDM/CogVideoX-5b-I2V",
    name: "CogVideoX 5B I2V",
    description: "Качественная image-to-video модель от THUDM. ~24GB VRAM.",
    num_inference_steps: 50,
    guidance_scale: 6.0,
    num_frames: 49,
    fps: 8,
    vram_gb: 24,
    is_rapid: false,
    supports_t2v: false,
    supports_i2v: true,
    min_steps: 20,
    max_steps: 100,
    min_guidance: 1,
    max_guidance: 15,
  },
  "Wan-AI/Wan2.2-I2V-14B-480P-Diffusers": {
    model_id: "Wan-AI/Wan2.2-I2V-14B-480P-Diffusers",
    name: "WAN 2.2 I2V 14B",
    description:
      "Официальная высококачественная WAN 2.2 модель. 24 FPS, ~48GB VRAM.",
    num_inference_steps: 50,
    guidance_scale: 6.0,
    num_frames: 49,
    fps: 24,
    vram_gb: 48,
    is_rapid: false,
    supports_t2v: false,
    supports_i2v: true,
    min_steps: 20,
    max_steps: 100,
    min_guidance: 1,
    max_guidance: 15,
  },
  "tencent/HunyuanVideo": {
    model_id: "tencent/HunyuanVideo",
    name: "HunyuanVideo",
    description:
      "Высочайшее качество text-to-video от Tencent. 30 FPS, требует ~60GB VRAM.",
    num_inference_steps: 50,
    guidance_scale: 6.0,
    num_frames: 49,
    fps: 30,
    vram_gb: 60,
    is_rapid: false,
    supports_t2v: true,
    supports_i2v: false,
    min_steps: 20,
    max_steps: 100,
    min_guidance: 1,
    max_guidance: 15,
  },
};

export const DEFAULT_VIDEO_PRESET: VideoPreset = {
  model_id: "default",
  name: "Default",
  description: "Стандартные настройки для видео моделей.",
  num_inference_steps: 50,
  guidance_scale: 6.0,
  num_frames: 49,
  fps: 24,
  vram_gb: 24,
  is_rapid: false,
  supports_t2v: true,
  supports_i2v: true,
  min_steps: 10,
  max_steps: 100,
  min_guidance: 1,
  max_guidance: 15,
};

// ============== Helper Functions ==============

export function getVideoPreset(modelId: string): VideoPreset {
  return VIDEO_PRESETS[modelId] ?? DEFAULT_VIDEO_PRESET;
}

export function getAllVideoPresets(): Record<string, VideoPreset> {
  return { ...VIDEO_PRESETS };
}

export function getImageTo3DPreset(modelId: string): ImageTo3DPreset {
  return IMAGE_TO_3D_PRESETS[modelId] ?? DEFAULT_IMAGE_TO_3D_PRESET;
}

export function getAllImageTo3DPresets(): Record<string, ImageTo3DPreset> {
  return { ...IMAGE_TO_3D_PRESETS };
}

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

// ============== LLM Helper Functions ==============

export function getLLMPreset(modelId: string): LLMPreset {
  // Try exact match first
  if (LLM_PRESETS[modelId]) {
    return LLM_PRESETS[modelId];
  }

  // Try matching by short name (e.g., "NemoMix-Unleashed-12B")
  const shortName = modelId.split("/").pop() || modelId;
  for (const [key, preset] of Object.entries(LLM_PRESETS)) {
    if (key.endsWith(shortName) || key.includes(shortName)) {
      return preset;
    }
  }

  return DEFAULT_LLM_PRESET;
}

export function getAllLLMPresets(): Record<string, LLMPreset> {
  return { ...LLM_PRESETS };
}
