/**
 * Video generation types.
 */

export type VideoPreset = {
  model_id: string;
  name: string;
  description: string;
  // Generation parameters
  num_inference_steps: number;
  guidance_scale: number;
  num_frames: number;
  fps: number;
  // Memory requirements
  vram_gb: number;
  // Model characteristics
  is_rapid: boolean;
  supports_t2v: boolean;
  supports_i2v: boolean;
  // UI hints
  min_steps: number;
  max_steps: number;
  min_guidance: number;
  max_guidance: number;
};

export type VideoModelsResponse = {
  models: string[];
  current_model: string | null;
  presets: Record<string, VideoPreset>;
};

export type VideoTaskResponse = {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number | null;
  video_base64: string | null;
  error: string | null;
};
