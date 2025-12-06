import "dotenv/config";
import { auth } from "@ai-lab/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import llmRoutes from "./routes/llm";
import mediaRoutes from "./routes/media";
import modelsRoutes from "./routes/models";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// API routes
app.route("/api/llm", llmRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/models", modelsRoutes);

app.get("/", (c) => c.text("OK"));

export default app;
