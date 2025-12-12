import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Try to load .env from gateway (for local dev), ignore if not found
try {
  dotenv.config({
    path: "../../apps/gateway/.env",
  });
} catch {
  // Ignore - DATABASE_URL should be set via environment in production
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
