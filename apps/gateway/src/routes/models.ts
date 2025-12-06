import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

type ContentfulStatusCode =
  | 200
  | 201
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 500
  | 502
  | 503;

const AI_API_URL = process.env.AI_API_URL || "http://localhost:8000";

const models = new Hono();

// Schemas
const modelTypeSchema = z.enum(["llm", "image", "image2image", "video"]);

const loadModelSchema = z.object({
  model_id: z.string().min(1),
  model_type: modelTypeSchema,
  force: z.boolean().optional().default(false),
});

const unloadModelSchema = z.object({
  model_id: z.string().min(1),
  model_type: modelTypeSchema,
});

const downloadCacheSchema = z.object({
  repo_id: z.string().min(1),
  model_type: modelTypeSchema,
  revision: z.string().optional(),
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
  disk_total_gb: number | null;
  disk_used_gb: number | null;
  disk_free_gb: number | null;
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

// Cache types
type CachedModel = {
  repo_id: string;
  repo_type: string;
  size_on_disk: number;
  nb_files: number;
  last_accessed: string | null;
  last_modified: string | null;
  revisions: string[];
};

type CacheListResponse = {
  models: CachedModel[];
  total_size_bytes: number;
  cache_dir: string;
};

type DownloadModelResponse = {
  repo_id: string;
  status: string;
  message: string;
  size_bytes: number | null;
};

type DeleteCacheResponse = {
  repo_id: string;
  status: string;
  message: string;
  freed_bytes: number | null;
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
      response.status as ContentfulStatusCode
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
      response.status as ContentfulStatusCode
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
      response.status as ContentfulStatusCode
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

// ==================== Cache Management ====================

// Get all cached models on disk
models.get("/cache", async (c) => {
  const response = await fetch(`${AI_API_URL}/models/cache`);

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to fetch cache: ${error}` }, 500);
  }

  const data = (await response.json()) as CacheListResponse;
  return c.json(data);
});

// Download a model to cache (without loading to GPU)
models.post(
  "/cache/download",
  zValidator("json", downloadCacheSchema),
  async (c) => {
    const body = c.req.valid("json");

    const response = await fetch(`${AI_API_URL}/models/cache/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = (await response
        .json()
        .catch(() => ({ detail: "Unknown error" }))) as { detail: string };
      return c.json(
        { error: error.detail || "Failed to download model" },
        response.status as ContentfulStatusCode
      );
    }

    const data = (await response.json()) as DownloadModelResponse;
    return c.json(data);
  }
);

// Delete a model from cache
models.delete("/cache/:repoId{.+}", async (c) => {
  // Use wildcard pattern to capture repo_id with slashes (e.g., "meta-llama/Llama-3.2-3B")
  const repoId = c.req.param("repoId");

  const response = await fetch(
    `${AI_API_URL}/models/cache/${encodeURIComponent(repoId)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => ({ detail: "Unknown error" }))) as { detail: string };
    return c.json(
      { error: error.detail || "Failed to delete cached model" },
      response.status as ContentfulStatusCode
    );
  }

  const data = (await response.json()) as DeleteCacheResponse;
  return c.json(data);
});

export default models;
