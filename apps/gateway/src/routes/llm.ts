import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

const AI_API_URL = process.env.AI_API_URL || "http://localhost:8000";

const llm = new Hono();

// Schemas
const chatSchema = z.object({
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  stream: z.boolean().optional().default(true),
  options: z
    .object({
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      top_k: z.number().optional(),
      max_tokens: z.number().optional(),
    })
    .optional(),
});

const compareSchema = z.object({
  models: z.array(z.string()).min(1).max(5),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  options: z
    .object({
      temperature: z.number().optional(),
      top_p: z.number().optional(),
      top_k: z.number().optional(),
      max_tokens: z.number().optional(),
    })
    .optional(),
});

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AIApiResponse = {
  model: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
};

// Get available models
llm.get("/models", async (c) => {
  const response = await fetch(`${AI_API_URL}/api/tags`);

  if (!response.ok) {
    return c.json({ error: "Failed to fetch models from AI API" }, 500);
  }

  const data = (await response.json()) as {
    models: Array<{ name: string; size: number; modified_at: string }>;
  };

  return c.json({
    models: data.models.map((m) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
    })),
  });
});

// Chat with single model (streaming)
llm.post("/chat", zValidator("json", chatSchema), async (c) => {
  const body = c.req.valid("json");

  // Map options to top-level params for ai-api
  const aiApiPayload = {
    model: body.model,
    messages: body.messages,
    stream: body.stream,
    temperature: body.options?.temperature ?? 0.7,
    top_p: body.options?.top_p ?? 0.95,
    top_k: body.options?.top_k ?? 40,
    max_tokens: body.options?.max_tokens ?? 2048,
  };

  if (body.stream) {
    return streamSSE(c, async (stream) => {
      const response = await fetch(`${AI_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiApiPayload),
      });

      if (!(response.ok && response.body)) {
        await stream.writeSSE({
          data: JSON.stringify({ error: "Failed to connect to AI API" }),
          event: "error",
        });
        return;
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
          // SSE format: "event: xxx\ndata: {...}"
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") {
              await stream.writeSSE({ data: "[DONE]", event: "done" });
              return;
            }
            const data = JSON.parse(jsonStr) as AIApiResponse;
            await stream.writeSSE({
              data: JSON.stringify({
                content: data.message?.content || "",
                done: data.done,
                model: data.model,
              }),
              event: "message",
            });
          }
        }
      }

      await stream.writeSSE({ data: "[DONE]", event: "done" });
    });
  }

  // Non-streaming response
  const response = await fetch(`${AI_API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aiApiPayload),
  });

  if (!response.ok) {
    return c.json({ error: "Failed to get response from AI API" }, 500);
  }

  const data = (await response.json()) as AIApiResponse;

  return c.json({
    model: data.model,
    message: data.message,
    total_duration: data.total_duration,
    eval_count: data.eval_count,
  });
});

// Compare multiple models (streaming) - proxies to ai-api /api/compare
llm.post("/compare", zValidator("json", compareSchema), (c) => {
  const body = c.req.valid("json");

  // Map options to top-level params for ai-api
  const aiApiPayload = {
    models: body.models,
    messages: body.messages,
    temperature: body.options?.temperature ?? 0.7,
    top_p: body.options?.top_p ?? 0.95,
    top_k: body.options?.top_k ?? 40,
    max_tokens: body.options?.max_tokens ?? 2048,
  };

  return streamSSE(c, async (stream) => {
    const response = await fetch(`${AI_API_URL}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiApiPayload),
    });

    if (!(response.ok && response.body)) {
      await stream.writeSSE({
        data: JSON.stringify({ error: "Failed to connect to AI API" }),
        event: "error",
      });
      return;
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

      let currentEvent = "chunk";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          // Forward the SSE event as-is
          await stream.writeSSE({
            data: jsonStr,
            event: currentEvent,
          });
        }
      }
    }
  });
});

export default llm;
