import type {
  QueueStats,
  Task,
  TaskListResponse,
  TaskResult,
} from "@ai-lab/shared/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const AI_API_URL = process.env.AI_API_URL || "http://localhost:8000";

const tasks = new Hono();

// Task types
const taskTypeSchema = z.enum(["video", "image", "image2image", "llm_compare"]);

// Schemas
const createTaskSchema = z.object({
  type: taskTypeSchema,
  params: z.record(z.string(), z.unknown()),
  user_id: z.string().optional(),
});

// Create a new task
tasks.post("/", zValidator("json", createTaskSchema), async (c) => {
  const body = c.req.valid("json");

  const response = await fetch(`${AI_API_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    return c.json({ error: `Failed to create task: ${error}` }, 500);
  }

  const data = (await response.json()) as Task;
  return c.json(data);
});

// Get queue statistics
tasks.get("/stats", async (c) => {
  const response = await fetch(`${AI_API_URL}/tasks/stats`);

  if (!response.ok) {
    return c.json({ error: "Failed to get queue stats" }, 500);
  }

  const data = (await response.json()) as QueueStats;
  return c.json(data);
});

// List tasks (with optional user_id filter)
tasks.get("/", async (c) => {
  const userId = c.req.query("user_id");
  const limit = c.req.query("limit") || "20";

  const params = new URLSearchParams();
  if (userId) {
    params.set("user_id", userId);
  }
  params.set("limit", limit);

  const response = await fetch(`${AI_API_URL}/tasks?${params.toString()}`);

  if (!response.ok) {
    return c.json({ error: "Failed to list tasks" }, 500);
  }

  const data = (await response.json()) as TaskListResponse;
  return c.json(data);
});

// Get task status
tasks.get("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const response = await fetch(`${AI_API_URL}/tasks/${taskId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json({ error: "Failed to get task status" }, 500);
  }

  const data = (await response.json()) as Task;
  return c.json(data);
});

// Get task result (includes base64 data)
tasks.get("/:taskId/result", async (c) => {
  const taskId = c.req.param("taskId");

  const response = await fetch(`${AI_API_URL}/tasks/${taskId}/result`);

  if (!response.ok) {
    if (response.status === 404) {
      return c.json({ error: "Task not found" }, 404);
    }
    if (response.status === 400) {
      const error = await response.json();
      return c.json(error, 400);
    }
    return c.json({ error: "Failed to get task result" }, 500);
  }

  const data = (await response.json()) as TaskResult;
  return c.json(data);
});

// Cancel a task
tasks.post("/:taskId/cancel", async (c) => {
  const taskId = c.req.param("taskId");

  const response = await fetch(`${AI_API_URL}/tasks/${taskId}/cancel`, {
    method: "POST",
  });

  if (!response.ok) {
    if (response.status === 404) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json({ error: "Failed to cancel task" }, 500);
  }

  const data = (await response.json()) as Task;
  return c.json(data);
});

export default tasks;
