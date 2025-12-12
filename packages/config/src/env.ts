import { z } from "zod";

/**
 * Environment configuration schema with validation.
 * Use this for centralized, type-safe environment variable access.
 */

// ============== Gateway Config ==============

const gatewayEnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  AI_API_URL: z.string().url().default("http://localhost:8000"),
  CORS_ORIGIN: z.string().default("http://localhost:3001"),
  REDIS_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
});

export type GatewayEnv = z.infer<typeof gatewayEnvSchema>;

export function getGatewayConfig(): GatewayEnv {
  return gatewayEnvSchema.parse(process.env);
}

// ============== Web Config ==============

const webEnvSchema = z.object({
  NEXT_PUBLIC_GATEWAY_URL: z.string().url().default("http://localhost:3000"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebConfig(): WebEnv {
  return webEnvSchema.parse(process.env);
}

// ============== AI API Config ==============

const aiApiEnvSchema = z.object({
  MODEL_IDS: z.string().optional(),
  TENSOR_PARALLEL_SIZE: z.coerce.number().default(1),
  GPU_MEMORY_UTILIZATION: z.coerce.number().default(0.9),
  MAX_MODEL_LEN: z.coerce.number().optional(),
  IMAGE_MODEL: z.string().optional(),
  IMAGE2IMAGE_MODEL: z.string().optional(),
  VIDEO_MODEL: z.string().optional(),
  IMAGE_TO_3D_MODEL: z.string().optional(),
  ENABLE_IMAGE: z.coerce.boolean().default(true),
  ENABLE_IMAGE2IMAGE: z.coerce.boolean().default(true),
  ENABLE_VIDEO: z.coerce.boolean().default(true),
  ENABLE_IMAGE_TO_3D: z.coerce.boolean().default(false),
  REDIS_URL: z.string().optional(),
  TASK_TTL_HOURS: z.coerce.number().default(24),
});

export type AiApiEnv = z.infer<typeof aiApiEnvSchema>;

export function getAiApiConfig(): AiApiEnv {
  return aiApiEnvSchema.parse(process.env);
}

// ============== Common Config ==============

const commonEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DEBUG: z.coerce.boolean().default(false),
});

export type CommonEnv = z.infer<typeof commonEnvSchema>;

export function getCommonConfig(): CommonEnv {
  return commonEnvSchema.parse(process.env);
}

/**
 * Check if we're in development mode.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if we're in production mode.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if debug mode is enabled.
 */
export function isDebugEnabled(): boolean {
  return process.env.DEBUG === "true" || isDevelopment();
}
