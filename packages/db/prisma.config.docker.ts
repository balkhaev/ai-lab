import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Docker config - runs from /app/prisma directory
export default defineConfig({
  schema: path.join("schema"),
  migrations: {
    path: path.join("migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
