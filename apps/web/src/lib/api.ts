const API_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:3000";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type Model = {
  name: string;
  size: number;
  modified_at: string;
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
};

export type ImageGenerationResponse = {
  image_base64: string;
  seed: number;
  generation_time: number;
};

export type VideoTaskResponse = {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number | null;
  video_base64: string | null;
  error: string | null;
};

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

export type Image2ImageModelsResponse = {
  models: string[];
  current_model: string | null;
};

export type Image2ImageResponse = {
  image_base64: string;
  seed: number;
  generation_time: number;
};

// LLM API
export async function getModels(): Promise<Model[]> {
  const response = await fetch(`${API_URL}/api/llm/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  const data = (await response.json()) as { models: Model[] };
  return data.models;
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
  return data.message.content;
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

export type CompareChunk = {
  model: string;
  content: string;
  done: boolean;
};

export type CompareModelDone = {
  model: string;
  fullContent: string;
  duration: number;
  eval_count?: number;
};

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

export async function generateVideo(
  image: File,
  prompt: string,
  options?: {
    num_inference_steps?: number;
    guidance_scale?: number;
    num_frames?: number;
    seed?: number;
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

// Model Management API
export type ModelType = "llm" | "image" | "image2image" | "video";
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

// Task Queue API
export type TaskType = "video" | "image" | "image2image" | "llm_compare";
export type TaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type Task = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type TaskResult = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  result: Record<string, unknown> | null;
  error: string | null;
};

export type TaskListResponse = {
  tasks: Task[];
  total: number;
};

export type QueueStats = {
  pending: number;
  processing: number;
};

export type CreateTaskParams = {
  type: TaskType;
  params: Record<string, unknown>;
  user_id?: string;
};

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
