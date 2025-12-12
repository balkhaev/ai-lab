/**
 * Model management types.
 */

export type ModelType =
  | "llm"
  | "image"
  | "image2image"
  | "video"
  | "image_to_3d";

export type ModelStatus =
  | "not_loaded"
  | "loading"
  | "loaded"
  | "unloading"
  | "error";

export type ModelInfo = {
  model_id: string;
  model_type: ModelType;
  status: ModelStatus;
  name: string;
  loaded_at: string | null;
  memory_usage_mb: number | null;
  error: string | null;
};

export type ModelsListResponse = {
  models: ModelInfo[];
  gpu_memory_total_mb: number | null;
  gpu_memory_used_mb: number | null;
  gpu_memory_free_mb: number | null;
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  disk_free_gb: number | null;
};

export type LoadModelRequest = {
  model_id: string;
  model_type: ModelType;
  force?: boolean;
};

export type LoadModelResponse = {
  model_id: string;
  status: ModelStatus;
  message: string;
};

export type UnloadModelRequest = {
  model_id: string;
  model_type: ModelType;
};

export type UnloadModelResponse = {
  model_id: string;
  status: ModelStatus;
  message: string;
  freed_memory_mb: number | null;
};

// Cache Management

export type CachedModel = {
  repo_id: string;
  repo_type: string;
  size_on_disk: number;
  nb_files: number;
  last_accessed: string | null;
  last_modified: string | null;
  revisions: string[];
};

export type CacheListResponse = {
  models: CachedModel[];
  total_size_bytes: number;
  cache_dir: string;
};

export type DownloadModelRequest = {
  repo_id: string;
  model_type: ModelType;
  revision?: string;
};

export type DownloadModelResponse = {
  repo_id: string;
  status: string;
  message: string;
  size_bytes: number | null;
};

export type DeleteCacheResponse = {
  repo_id: string;
  status: string;
  message: string;
  freed_bytes: number | null;
};

// Health

export type HealthResponse = {
  status: string;
  device: string;
  cuda_available: boolean;
  models_loaded: string[];
};
