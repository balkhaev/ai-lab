import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

const AI_URL = process.env.AI_URL || "http://localhost:8000";

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
    })
    .optional(),
});

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaResponse = {
  model: string;
  message: ChatMessage;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
};

// Get available models
llm.get("/models", async (c) => {
  const response = await fetch(`${AI_URL}/api/tags`);

  if (!response.ok) {
    return c.json({ error: "Failed to fetch models from LLM service" }, 500);
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

  if (body.stream) {
    return streamSSE(c, async (stream) => {
      const response = await fetch(`${AI_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: body.model,
          messages: body.messages,
          stream: true,
          options: body.options,
        }),
      });

      if (!(response.ok && response.body)) {
        await stream.writeSSE({
          data: JSON.stringify({ error: "Failed to connect to LLM service" }),
          event: "error",
        });
        return;
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
          if (line.trim()) {
            const data = JSON.parse(line) as OllamaResponse;
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
  const response = await fetch(`${AI_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: body.model,
      messages: body.messages,
      stream: false,
      options: body.options,
    }),
  });

  if (!response.ok) {
    return c.json({ error: "Failed to get response from LLM service" }, 500);
  }

  const data = (await response.json()) as OllamaResponse;

  return c.json({
    model: data.model,
    message: data.message,
    total_duration: data.total_duration,
    eval_count: data.eval_count,
  });
});

// Compare multiple models (streaming)
llm.post("/compare", zValidator("json", compareSchema), async (c) => {
  const body = c.req.valid("json");

  return streamSSE(c, async (stream) => {
    const startTime = Date.now();

    // Start all model requests in parallel
    const modelPromises = body.models.map(async (model) => {
      const modelStartTime = Date.now();

      const response = await fetch(`${AI_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: body.messages,
          stream: true,
          options: body.options,
        }),
      });

      if (!(response.ok && response.body)) {
        await stream.writeSSE({
          data: JSON.stringify({
            model,
            error: "Failed to connect",
            done: true,
          }),
          event: "model_error",
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            const data = JSON.parse(line) as OllamaResponse;
            const content = data.message?.content || "";
            fullContent += content;

            await stream.writeSSE({
              data: JSON.stringify({
                model,
                content,
                done: data.done,
              }),
              event: "chunk",
            });

            if (data.done) {
              const duration = Date.now() - modelStartTime;
              await stream.writeSSE({
                data: JSON.stringify({
                  model,
                  fullContent,
                  duration,
                  eval_count: data.eval_count,
                }),
                event: "model_done",
              });
            }
          }
        }
      }
    });

    await Promise.all(modelPromises);

    const totalDuration = Date.now() - startTime;
    await stream.writeSSE({
      data: JSON.stringify({ totalDuration }),
      event: "all_done",
    });
  });
});

export default llm;
