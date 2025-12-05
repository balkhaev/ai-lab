import type { auth } from "@ai-lab/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_GATEWAY_URL,
  plugins: [inferAdditionalFields<typeof auth>()],
});
