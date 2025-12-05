import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const AI_API_URL = process.env.AI_API_URL || "http://localhost:8000";

const media = new Hono();

// Schemas
const imageSchema = z.object({
  prompt: z.string().min(1),
  negative_prompt: z.string().optional().default(""),
  width: z.number().int().min(256).max(2048).optional().default(1024),
  height: z.number().int().min(256).max(2048).optional().default(1024),
  num_inference_steps: z.number().int().min(1).max(50).optional().default(4),
  guidance_scale: z.number().min(1).max(20).optional().default(3.5),
  seed: z.number().int().optional(),
});

type ImageGenerationResponse = {
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

// Generate image
media.post("/image", zValidator("json", imageSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await fetch(`${AI_API_URL}/generate/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to generate image: ${error}` }, 500);
  }

  const data = (await response.json()) as ImageGenerationResponse;
  return c.json(data);
});

// Generate video (start task)
media.post("/video", async (c) => {
  const formData = await c.req.formData();

  // Forward form data to AI API
  const response = await fetch(`${AI_API_URL}/generate/video`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to start video generation: ${error}` }, 500);
  }

  const data = (await response.json()) as VideoTaskResponse;
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

export default media;
