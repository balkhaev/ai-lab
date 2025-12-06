import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const AI_API_URL = process.env.AI_API_URL || "http://localhost:8000";

const models = new Hono();

// Schemas
const modelTypeSchema = z.enum(["llm", "image", "video"]);

const loadModelSchema = z.object({
  model_id: z.string().min(1),
  model_type: modelTypeSchema,
  force: z.boolean().optional().default(false),
});

const unloadModelSchema = z.object({
  model_id: z.string().min(1),
  model_type: modelTypeSchema,
});

// Types
type ModelsListResponse = {
  models: Array<{
    model_id: string;
    model_type: string;
    status: string;
    name: string;
    loaded_at: string | null;
    memory_usage_mb: number | null;
    error: string | null;
  }>;
  gpu_memory_total_mb: number | null;
  gpu_memory_used_mb: number | null;
  gpu_memory_free_mb: number | null;
};

type LoadModelResponse = {
  model_id: string;
  status: string;
  message: string;
};

type UnloadModelResponse = {
  model_id: string;
  status: string;
  message: string;
  freed_memory_mb: number | null;
};

// Get all models with GPU memory info
models.get("/", async (c) => {
  const response = await fetch(`${AI_API_URL}/models`);

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to fetch models: ${error}` }, 500);
  }

  const data = (await response.json()) as ModelsListResponse;
  return c.json(data);
});

// Load a model
models.post("/load", zValidator("json", loadModelSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await fetch(`${AI_API_URL}/models/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ detail: "Unknown error" }))) as { detail: string };
    return c.json(
      { error: error.detail || "Failed to load model" },
      response.status
    );
  }

  const data = (await response.json()) as LoadModelResponse;
  return c.json(data);
});

// Unload a model
models.post("/unload", zValidator("json", unloadModelSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await fetch(`${AI_API_URL}/models/unload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ detail: "Unknown error" }))) as { detail: string };
    return c.json(
      { error: error.detail || "Failed to unload model" },
      response.status
    );
  }

  const data = (await response.json()) as UnloadModelResponse;
  return c.json(data);
});

// Switch model (unload current + load new)
models.post("/switch", zValidator("json", loadModelSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await fetch(`${AI_API_URL}/models/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ detail: "Unknown error" }))) as { detail: string };
    return c.json(
      { error: error.detail || "Failed to switch model" },
      response.status
    );
  }

  const data = (await response.json()) as LoadModelResponse;
  return c.json(data);
});

// Get status of a specific model
models.get("/status/:modelId", async (c) => {
  const modelId = c.req.param("modelId");

  const response = await fetch(
    `${AI_API_URL}/models/status/${encodeURIComponent(modelId)}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return c.json({ error: "Model not found" }, 404);
    }
    return c.json({ error: "Failed to get model status" }, 500);
  }

  const data = await response.json();
  return c.json(data);
});

export default models;
