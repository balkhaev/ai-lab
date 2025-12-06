"use client";
import type { authClient } from "@/lib/auth-client";

export default function Dashboard({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  // TODO: Implement dashboard with session data
  console.log("Dashboard session:", session.user.name);
  return null;
}
