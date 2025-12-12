/**
 * Image-to-3D generation types.
 */

export type ImageTo3DPreset = {
  model_id: string;
  name: string;
  description: string;
  // Model capabilities
  outputs: {
    point_cloud: boolean;
    depth_map: boolean;
    normal_map: boolean;
    gaussians: boolean;
    camera_params: boolean;
  };
  // Memory requirements
  vram_gb: number;
  // UI hints
  supports_camera_intrinsics: boolean;
  supports_camera_pose: boolean;
  supports_depth_prior: boolean;
};

export type ImageTo3DModelsResponse = {
  models: string[];
  current_model: string | null;
  presets: Record<string, ImageTo3DPreset>;
};

export type ImageTo3DResult = {
  point_cloud_ply_base64: string | null;
  point_cloud_array: number[][] | null;
  depth_map: number[][] | null;
  normal_map: number[][][] | null;
  camera_params: Record<string, unknown> | null;
  gaussians: Record<string, unknown> | null;
  generation_time: number;
};

export type ImageTo3DTaskResponse = {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number | null;
  result: ImageTo3DResult | null;
  error: string | null;
};
