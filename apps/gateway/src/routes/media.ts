import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  getAllImage2ImagePresets,
  getAllImagePresets,
  getAllImageTo3DPresets,
  getImage2ImagePreset,
  getImagePreset,
  getImageTo3DPreset,
} from "../presets";

const AI_API_URL = process.env.AI_API_URL || "http://localhost:8000";

const media = new Hono();

// Schemas - parameters are optional, will use presets if not provided
const imageSchema = z.object({
  prompt: z.string().min(1),
  negative_prompt: z.string().optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
  num_inference_steps: z.number().int().min(1).max(100).optional(),
  guidance_scale: z.number().min(0).max(20).optional(),
  seed: z.number().int().optional(),
  model: z.string().optional(),
});

type ImageGenerationResponse = {
  image_base64: string;
  seed: number;
  generation_time: number;
};

type Image2ImageResponse = {
  image_base64: string;
  seed: number;
  generation_time: number;
};

type VideoTaskResponse = {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number | null;
  video_base64: string | null;
  error: string | null;
};

type TaskResponse = {
  id: string;
  type: "video" | "image" | "image2image" | "image_to_3d" | "llm_compare";
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

type ImageTo3DResult = {
  point_cloud_ply_base64: string | null;
  point_cloud_array: number[][] | null;
  depth_map: number[][] | null;
  normal_map: number[][][] | null;
  camera_params: Record<string, unknown> | null;
  gaussians: Record<string, unknown> | null;
  generation_time: number;
};

type ImageTo3DTaskResponse = {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number | null;
  result: ImageTo3DResult | null;
  error: string | null;
};

type HealthResponse = {
  status: string;
  device: string;
  cuda_available: boolean;
  models_loaded: string[];
};

// Health check for AI API service
media.get("/health", async (c) => {
  const response = await fetch(`${AI_API_URL}/health`);

  if (!response.ok) {
    return c.json({ error: "AI API unavailable" }, 503);
  }

  const data = (await response.json()) as HealthResponse;
  return c.json(data);
});

// Get available text2image models with presets
media.get("/image/models", async (c) => {
  const response = await fetch(`${AI_API_URL}/generate/image/models`);

  if (!response.ok) {
    return c.json({ error: "Failed to get models list" }, 500);
  }

  const data = (await response.json()) as {
    models: string[];
    current_model: string | null;
  };

  // Add presets from gateway
  const allPresets = getAllImagePresets();
  const presets: Record<string, ReturnType<typeof getImagePreset>> = {};
  for (const model of data.models) {
    presets[model] = allPresets[model] ?? getImagePreset(model);
  }

  return c.json({
    ...data,
    presets,
  });
});

// Generate image with preset support
media.post("/image", zValidator("json", imageSchema), async (c) => {
  const body = c.req.valid("json");

  // Get preset for the model
  const preset = getImagePreset(body.model ?? "");

  // Apply preset defaults for unspecified parameters
  const requestBody = {
    prompt: body.prompt,
    negative_prompt: preset.supports_negative_prompt
      ? (body.negative_prompt ?? "")
      : "",
    width: body.width ?? preset.width,
    height: body.height ?? preset.height,
    num_inference_steps: body.num_inference_steps ?? preset.num_inference_steps,
    guidance_scale: body.guidance_scale ?? preset.guidance_scale,
    seed: body.seed,
    model: body.model,
  };

  const response = await fetch(`${AI_API_URL}/generate/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to generate image: ${error}` }, 500);
  }

  const data = (await response.json()) as ImageGenerationResponse;
  return c.json(data);
});

// Get available image2image models with presets
media.get("/image2image/models", async (c) => {
  const response = await fetch(`${AI_API_URL}/generate/image2image/models`);

  if (!response.ok) {
    return c.json({ error: "Failed to get models list" }, 500);
  }

  const data = (await response.json()) as {
    models: string[];
    current_model: string | null;
  };

  // Add presets from gateway
  const allPresets = getAllImage2ImagePresets();
  const presets: Record<string, ReturnType<typeof getImage2ImagePreset>> = {};
  for (const model of data.models) {
    presets[model] = allPresets[model] ?? getImage2ImagePreset(model);
  }

  return c.json({
    ...data,
    presets,
  });
});

// Image-to-image transformation with preset support
media.post("/image2image", async (c) => {
  const formData = await c.req.formData();

  // Get model from form data to apply preset
  const model = formData.get("model")?.toString() ?? "";
  const preset = getImage2ImagePreset(model);

  // Apply preset defaults for unspecified parameters
  if (!formData.has("strength") || formData.get("strength") === "") {
    formData.set("strength", preset.strength.toString());
  }
  if (
    !formData.has("num_inference_steps") ||
    formData.get("num_inference_steps") === ""
  ) {
    formData.set("num_inference_steps", preset.num_inference_steps.toString());
  }
  if (
    !formData.has("guidance_scale") ||
    formData.get("guidance_scale") === ""
  ) {
    formData.set("guidance_scale", preset.guidance_scale.toString());
  }

  // Clear negative_prompt if model doesn't support it
  if (!preset.supports_negative_prompt) {
    formData.set("negative_prompt", "");
  }

  const response = await fetch(`${AI_API_URL}/generate/image2image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to transform image: ${error}` }, 500);
  }

  const data = (await response.json()) as Image2ImageResponse;
  return c.json(data);
});

// Generate video (start task)
media.post("/video", async (c) => {
  const formData = await c.req.formData();

  const response = await fetch(`${AI_API_URL}/generate/video`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to start video generation: ${error}` }, 500);
  }

  const data = (await response.json()) as TaskResponse;
  return c.json(data);
});

// Get video task status
media.get("/video/status/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const response = await fetch(`${AI_API_URL}/generate/video/status/${taskId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json({ error: "Failed to get task status" }, 500);
  }

  const data = (await response.json()) as VideoTaskResponse;
  return c.json(data);
});

// ==================== Image-to-3D Endpoints ====================

// Get available image-to-3D models with presets
media.get("/image-to-3d/models", async (c) => {
  const response = await fetch(`${AI_API_URL}/generate/image-to-3d/models`);

  if (!response.ok) {
    return c.json({ error: "Failed to get models list" }, 500);
  }

  const data = (await response.json()) as {
    models: string[];
    current_model: string | null;
  };

  // Add presets from gateway
  const allPresets = getAllImageTo3DPresets();
  const presets: Record<string, ReturnType<typeof getImageTo3DPreset>> = {};
  for (const model of data.models) {
    presets[model] = allPresets[model] ?? getImageTo3DPreset(model);
  }

  return c.json({
    ...data,
    presets,
  });
});

// Generate 3D from image (start task)
media.post("/image-to-3d", async (c) => {
  const formData = await c.req.formData();

  // Get model from form data to apply preset info
  const model = formData.get("model")?.toString() ?? "";
  const preset = getImageTo3DPreset(model);

  // Log what capabilities the model has (for debugging)
  console.log(`Image-to-3D request for model ${model || "default"}:`, {
    outputs: preset.outputs,
    vram_gb: preset.vram_gb,
  });

  const response = await fetch(`${AI_API_URL}/generate/image-to-3d`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json(
      { error: `Failed to start image-to-3D generation: ${error}` },
      500
    );
  }

  const data = (await response.json()) as TaskResponse;
  return c.json(data);
});

// Get image-to-3D task status
media.get("/image-to-3d/status/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const response = await fetch(
    `${AI_API_URL}/generate/image-to-3d/status/${taskId}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json({ error: "Failed to get task status" }, 500);
  }

  const data = (await response.json()) as ImageTo3DTaskResponse;
  return c.json(data);
});

export default media;
