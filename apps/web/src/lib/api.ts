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
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;

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
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        const eventType = line.slice(7);
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

export async function generateVideo(
  image: File,
  prompt: string,
  options?: {
    num_inference_steps?: number;
    guidance_scale?: number;
    num_frames?: number;
    seed?: number;
  }
): Promise<VideoTaskResponse> {
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

  return response.json() as Promise<VideoTaskResponse>;
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
export type ModelType = "llm" | "image" | "video";
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
