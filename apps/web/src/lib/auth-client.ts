import type { auth } from "@ai-lab/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Ensure we have an absolute URL for server-side requests
const getBaseURL = () => {
  const url = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (url) {
    return url;
  }
  // Fallback for development
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }
  return "";
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [inferAdditionalFields<typeof auth>()],
});
