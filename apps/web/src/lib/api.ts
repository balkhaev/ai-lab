// Re-export types from shared package
export type {
  CachedModel,
  CacheListResponse,
  ChatMessage,
  CompareChunk,
  CompareModelDone,
  ContentPart,
  CreateTaskParams,
  DeleteCacheResponse,
  DownloadModelRequest,
  DownloadModelResponse,
  HealthResponse,
  Image2ImageModelsResponse,
  Image2ImagePreset,
  Image2ImageResponse,
  ImageContent,
  ImageGenerationParams,
  ImageGenerationResponse,
  ImageModelsResponse,
  ImagePreset,
  ImageTo3DModelsResponse,
  ImageTo3DPreset,
  ImageTo3DResult,
  ImageTo3DTaskResponse,
  LLMModelsResponse,
  LLMPreset,
  LLMPromptFormat,
  LoadModelRequest,
  LoadModelResponse,
  Model,
  ModelInfo,
  ModelStatus,
  ModelsListResponse,
  ModelType,
  QueueStats,
  Task,
  TaskListResponse,
  TaskResult,
  TaskStatus,
  TaskType,
  TextContent,
  UnloadModelRequest,
  UnloadModelResponse,
  VideoModelsResponse,
  VideoPreset,
  VideoTaskResponse,
} from "@ai-lab/shared/types";

import type {
  CacheListResponse,
  ChatMessage,
  CompareChunk,
  CompareModelDone,
  ContentPart,
  CreateTaskParams,
  DeleteCacheResponse,
  DownloadModelRequest,
  DownloadModelResponse,
  Image2ImageModelsResponse,
  Image2ImageResponse,
  ImageGenerationParams,
  ImageGenerationResponse,
  ImageModelsResponse,
  ImageTo3DModelsResponse,
  ImageTo3DTaskResponse,
  LLMModelsResponse,
  LLMPreset,
  LoadModelRequest,
  LoadModelResponse,
  Model,
  ModelsListResponse,
  QueueStats,
  Task,
  TaskListResponse,
  TaskResult,
  UnloadModelRequest,
  UnloadModelResponse,
  VideoModelsResponse,
  VideoTaskResponse,
} from "@ai-lab/shared/types";

const API_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";

// Helper to create text-only message
export function textMessage(
  role: ChatMessage["role"],
  text: string
): ChatMessage {
  return { role, content: text };
}

// Helper to create message with images
export function multimodalMessage(
  role: ChatMessage["role"],
  text: string,
  imageUrls: string[]
): ChatMessage {
  const content: ContentPart[] = [];

  // Add images first
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  // Add text
  content.push({ type: "text", text });

  return { role, content };
}

// Helper to convert File to base64 data URL
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Image2ImageParams kept here as it uses File which is browser-specific
export type Image2ImageParams = {
  image: File;
  prompt: string;
  negative_prompt?: string;
  strength?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number;
  model?: string;
};

// ImageTo3DParams kept here as it uses File which is browser-specific
export type ImageTo3DParams = {
  image: File;
  model?: string;
  camera_intrinsics?: number[][];
  camera_pose?: number[][];
};

// LLM API
export async function getModels(): Promise<Model[]> {
  const response = await fetch(`${API_URL}/api/llm/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  const data = (await response.json()) as LLMModelsResponse;
  return data.models;
}

export async function getLLMPresets(): Promise<Record<string, LLMPreset>> {
  const response = await fetch(`${API_URL}/api/llm/presets`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch LLM presets");
  }

  const data = (await response.json()) as {
    presets: Record<string, LLMPreset>;
  };
  return data.presets;
}

export async function chatWithModel(
  model: string,
  messages: ChatMessage[],
  options?: { temperature?: number; top_p?: number; top_k?: number }
): Promise<string> {
  const response = await fetch(`${API_URL}/api/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to chat with model");
  }

  const data = (await response.json()) as { message: ChatMessage };
  const { content } = data.message;
  if (typeof content === "string") {
    return content;
  }
  // Extract text from multimodal content
  const textPart = content.find((part) => part.type === "text");
  return textPart?.text ?? "";
}

export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  options?: { temperature?: number; top_p?: number; top_k?: number }
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${API_URL}/api/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options,
    }),
  });

  if (!(response.ok && response.body)) {
    throw new Error("Failed to stream chat");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          return;
        }

        const parsed = JSON.parse(data) as { content?: string };
        if (parsed.content) {
          yield parsed.content;
        }
      }
    }
  }
}

export async function* streamCompare(
  models: string[],
  messages: ChatMessage[],
  options?: { temperature?: number; top_p?: number; top_k?: number }
): AsyncGenerator<
  | { type: "chunk"; data: CompareChunk }
  | { type: "model_done"; data: CompareModelDone }
  | { type: "all_done"; totalDuration: number },
  void,
  unknown
> {
  const response = await fetch(`${API_URL}/api/llm/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      models,
      messages,
      options,
    }),
  });

  if (!(response.ok && response.body)) {
    throw new Error("Failed to stream compare");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        const _eventType = line.slice(7);
        continue;
      }
      if (line.startsWith("data: ")) {
        const dataStr = line.slice(6);
        const data = JSON.parse(dataStr);

        // Determine event type from data
        if (data.totalDuration !== undefined) {
          yield { type: "all_done", totalDuration: data.totalDuration };
        } else if (data.fullContent !== undefined) {
          yield { type: "model_done", data: data as CompareModelDone };
        } else if (data.content !== undefined) {
          yield { type: "chunk", data: data as CompareChunk };
        }
      }
    }
  }
}

// Media API
export async function getImageModels(): Promise<ImageModelsResponse> {
  const response = await fetch(`${API_URL}/api/media/image/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get image models");
  }

  return response.json() as Promise<ImageModelsResponse>;
}

export async function generateImage(
  params: ImageGenerationParams
): Promise<ImageGenerationResponse> {
  const response = await fetch(`${API_URL}/api/media/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate image: ${error}`);
  }

  return response.json() as Promise<ImageGenerationResponse>;
}

export async function getImage2ImageModels(): Promise<Image2ImageModelsResponse> {
  const response = await fetch(`${API_URL}/api/media/image2image/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get image2image models");
  }

  return response.json() as Promise<Image2ImageModelsResponse>;
}

export async function generateImage2Image(
  params: Image2ImageParams
): Promise<Image2ImageResponse> {
  const formData = new FormData();
  formData.append("image", params.image);
  formData.append("prompt", params.prompt);

  if (params.negative_prompt) {
    formData.append("negative_prompt", params.negative_prompt);
  }
  if (params.strength !== undefined) {
    formData.append("strength", params.strength.toString());
  }
  if (params.num_inference_steps !== undefined) {
    formData.append(
      "num_inference_steps",
      params.num_inference_steps.toString()
    );
  }
  if (params.guidance_scale !== undefined) {
    formData.append("guidance_scale", params.guidance_scale.toString());
  }
  if (params.seed !== undefined) {
    formData.append("seed", params.seed.toString());
  }
  if (params.model) {
    formData.append("model", params.model);
  }

  const response = await fetch(`${API_URL}/api/media/image2image`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to transform image: ${error}`);
  }

  return response.json() as Promise<Image2ImageResponse>;
}

export async function getVideoModels(): Promise<VideoModelsResponse> {
  const response = await fetch(`${API_URL}/api/media/video/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get video models");
  }

  return response.json() as Promise<VideoModelsResponse>;
}

export async function generateVideo(
  image: File,
  prompt: string,
  options?: {
    num_inference_steps?: number;
    guidance_scale?: number;
    num_frames?: number;
    seed?: number;
    model?: string;
  }
): Promise<Task> {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("prompt", prompt);

  if (options?.num_inference_steps) {
    formData.append(
      "num_inference_steps",
      options.num_inference_steps.toString()
    );
  }
  if (options?.guidance_scale) {
    formData.append("guidance_scale", options.guidance_scale.toString());
  }
  if (options?.num_frames) {
    formData.append("num_frames", options.num_frames.toString());
  }
  if (options?.seed) {
    formData.append("seed", options.seed.toString());
  }
  if (options?.model) {
    formData.append("model", options.model);
  }

  const response = await fetch(`${API_URL}/api/media/video`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start video generation: ${error}`);
  }

  return response.json() as Promise<Task>;
}

export async function getVideoStatus(
  taskId: string
): Promise<VideoTaskResponse> {
  const response = await fetch(`${API_URL}/api/media/video/status/${taskId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get video status");
  }

  return response.json() as Promise<VideoTaskResponse>;
}

export async function getMediaHealth(): Promise<{
  status: string;
  device: string;
  cuda_available: boolean;
  models_loaded: string[];
}> {
  const response = await fetch(`${API_URL}/api/media/health`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Media service unavailable");
  }

  return response.json();
}

// ==================== Image-to-3D API ====================

export async function getImageTo3DModels(): Promise<ImageTo3DModelsResponse> {
  const response = await fetch(`${API_URL}/api/media/image-to-3d/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get image-to-3D models");
  }

  return response.json() as Promise<ImageTo3DModelsResponse>;
}

export async function generateImageTo3D(
  params: ImageTo3DParams
): Promise<Task> {
  const formData = new FormData();
  formData.append("image", params.image);

  if (params.model) {
    formData.append("model", params.model);
  }
  if (params.camera_intrinsics) {
    formData.append(
      "camera_intrinsics",
      JSON.stringify(params.camera_intrinsics)
    );
  }
  if (params.camera_pose) {
    formData.append("camera_pose", JSON.stringify(params.camera_pose));
  }

  const response = await fetch(`${API_URL}/api/media/image-to-3d`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start image-to-3D generation: ${error}`);
  }

  return response.json() as Promise<Task>;
}

export async function getImageTo3DStatus(
  taskId: string
): Promise<ImageTo3DTaskResponse> {
  const response = await fetch(
    `${API_URL}/api/media/image-to-3d/status/${taskId}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get image-to-3D status");
  }

  return response.json() as Promise<ImageTo3DTaskResponse>;
}

// Model Management API

export async function getModelsList(): Promise<ModelsListResponse> {
  const response = await fetch(`${API_URL}/api/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models list");
  }

  return response.json();
}

export async function loadModel(
  request: LoadModelRequest
): Promise<LoadModelResponse> {
  const response = await fetch(`${API_URL}/api/models/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to load model");
  }

  return response.json();
}

export async function unloadModel(
  request: UnloadModelRequest
): Promise<UnloadModelResponse> {
  const response = await fetch(`${API_URL}/api/models/unload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to unload model");
  }

  return response.json();
}

export async function switchModel(
  request: LoadModelRequest
): Promise<LoadModelResponse> {
  const response = await fetch(`${API_URL}/api/models/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to switch model");
  }

  return response.json();
}

// Cache Management API

export async function getCachedModels(): Promise<CacheListResponse> {
  const response = await fetch(`${API_URL}/api/models/cache`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch cached models");
  }

  return response.json();
}

export async function downloadModelToCache(
  request: DownloadModelRequest
): Promise<DownloadModelResponse> {
  const response = await fetch(`${API_URL}/api/models/cache/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to download model");
  }

  return response.json();
}

export async function deleteCachedModel(
  repoId: string
): Promise<DeleteCacheResponse> {
  const response = await fetch(
    `${API_URL}/api/models/cache/${encodeURIComponent(repoId)}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete cached model");
  }

  return response.json();
}

// Task Queue API

export async function createTask(request: CreateTaskParams): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create task: ${error}`);
  }

  return response.json();
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Task not found");
    }
    throw new Error("Failed to get task status");
  }

  return response.json();
}

export async function getTaskResult(taskId: string): Promise<TaskResult> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/result`, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Task not found");
    }
    const error = await response.json();
    throw new Error(error.detail || "Failed to get task result");
  }

  return response.json();
}

export async function cancelTask(taskId: string): Promise<Task> {
  const response = await fetch(`${API_URL}/api/tasks/${taskId}/cancel`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Task not found");
    }
    throw new Error("Failed to cancel task");
  }

  return response.json();
}

export async function getTasks(
  userId?: string,
  limit = 20
): Promise<TaskListResponse> {
  const params = new URLSearchParams();
  if (userId) {
    params.set("user_id", userId);
  }
  params.set("limit", limit.toString());

  const response = await fetch(`${API_URL}/api/tasks?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to list tasks");
  }

  return response.json();
}

export async function getQueueStats(): Promise<QueueStats> {
  const response = await fetch(`${API_URL}/api/tasks/stats`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to get queue stats");
  }

  return response.json();
}
