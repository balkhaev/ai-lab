import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  output: "standalone",
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
