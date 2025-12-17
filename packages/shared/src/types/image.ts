/**
 * Image generation types for text-to-image and image-to-image.
 */

// ============== Text-to-Image ==============

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
  // LoRA configuration (optional)
  lora_repo?: string; // HuggingFace repo or local path
  lora_weight_name?: string; // safetensors filename
  lora_scale?: number; // LoRA adapter weight (default 1.0)
  lora_trigger_word?: string; // Trigger word to add to prompt
  base_model_id?: string; // Base model for LoRA (if different from model_id)
};

export type ImageGenerationParams = {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
  model?: string;
};

export type ImageModelsResponse = {
  models: string[];
  current_model: string | null;
  presets: Record<string, ImagePreset>;
};

export type ImageGenerationResponse = {
  image_base64: string;
  seed: number;
  generation_time: number;
};

// ============== Image-to-Image ==============

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
  // LoRA configuration (optional)
  lora_repo?: string; // HuggingFace repo or local path
  lora_weight_name?: string; // safetensors filename
  lora_scale?: number; // LoRA adapter weight (default 1.0)
  lora_trigger_word?: string; // Trigger word to add to prompt
};

export type Image2ImageModelsResponse = {
  models: string[];
  current_model: string | null;
  presets: Record<string, Image2ImagePreset>;
};

export type Image2ImageResponse = {
  image_base64: string;
  seed: number;
  generation_time: number;
};
