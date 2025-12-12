import type {
  HealthResponse,
  Image2ImageResponse,
  ImageGenerationResponse,
  ImageTo3DTaskResponse,
  Task,
  VideoTaskResponse,
} from "@ai-lab/shared/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  getAllImage2ImagePresets,
  getAllImagePresets,
  getAllImageTo3DPresets,
  getAllVideoPresets,
  getImage2ImagePreset,
  getImagePreset,
  getImageTo3DPreset,
  getVideoPreset,
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
  try {
    const response = await fetch(`${AI_API_URL}/generate/image/models`);

    if (response.ok) {
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
    }
  } catch {
    // ai-api is not available, fallback to presets
  }

  // Fallback: return models from presets when ai-api is unavailable
  const allPresets = getAllImagePresets();
  const models = Object.keys(allPresets);

  return c.json({
    models,
    current_model: null,
    presets: allPresets,
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
  try {
    const response = await fetch(`${AI_API_URL}/generate/image2image/models`);

    if (response.ok) {
      const data = (await response.json()) as {
        models: string[];
        current_model: string | null;
      };

      // Add presets from gateway
      const allPresets = getAllImage2ImagePresets();
      const presets: Record<
        string,
        ReturnType<typeof getImage2ImagePreset>
      > = {};
      for (const model of data.models) {
        presets[model] = allPresets[model] ?? getImage2ImagePreset(model);
      }

      return c.json({
        ...data,
        presets,
      });
    }
  } catch {
    // ai-api is not available, fallback to presets
  }

  // Fallback: return models from presets when ai-api is unavailable
  const allPresets = getAllImage2ImagePresets();
  const models = Object.keys(allPresets);

  return c.json({
    models,
    current_model: null,
    presets: allPresets,
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

// Get available video models with presets
media.get("/video/models", async (c) => {
  try {
    const response = await fetch(`${AI_API_URL}/generate/video/models`);

    if (response.ok) {
      const data = (await response.json()) as {
        models: string[];
        current_model: string | null;
      };

      // Add presets from gateway
      const allPresets = getAllVideoPresets();
      const presets: Record<string, ReturnType<typeof getVideoPreset>> = {};
      for (const model of data.models) {
        presets[model] = allPresets[model] ?? getVideoPreset(model);
      }

      return c.json({
        ...data,
        presets,
      });
    }
  } catch {
    // ai-api is not available, fallback to presets
  }

  // Fallback: return models from presets when ai-api is unavailable
  const allPresets = getAllVideoPresets();
  const models = Object.keys(allPresets);

  return c.json({
    models,
    current_model: null,
    presets: allPresets,
  });
});

// Generate video (start task) with preset support
media.post("/video", async (c) => {
  const formData = await c.req.formData();

  // Get model from form data to apply preset
  const model = formData.get("model")?.toString() ?? "";
  const preset = getVideoPreset(model);

  // Apply preset defaults for unspecified parameters
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
  if (!formData.has("num_frames") || formData.get("num_frames") === "") {
    formData.set("num_frames", preset.num_frames.toString());
  }

  const response = await fetch(`${AI_API_URL}/generate/video`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to start video generation: ${error}` }, 500);
  }

  const data = (await response.json()) as Task;
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
  try {
    const response = await fetch(`${AI_API_URL}/generate/image-to-3d/models`);

    if (response.ok) {
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
    }
  } catch {
    // ai-api is not available, fallback to presets
  }

  // Fallback: return models from presets when ai-api is unavailable
  const allPresets = getAllImageTo3DPresets();
  const models = Object.keys(allPresets);

  return c.json({
    models,
    current_model: null,
    presets: allPresets,
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

  const data = (await response.json()) as Task;
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
