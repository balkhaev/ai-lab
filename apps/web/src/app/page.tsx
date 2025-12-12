import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { ModelsStatus } from "@/components/dashboard/models-status";
import { RecentGenerations } from "@/components/dashboard/recent-generations";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { authClient } from "@/lib/auth-client";

type SessionData = Awaited<ReturnType<typeof authClient.getSession>>["data"];

export default async function DashboardPage() {
  let session: SessionData = null;

  try {
    const result = await authClient.getSession({
      fetchOptions: {
        headers: await headers(),
      },
    });
    session = result?.data ?? null;
  } catch {
    // Auth service unavailable or URL parsing error - redirect to login
    redirect("/login");
  }

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Welcome header */}
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">
          Добро пожаловать,{" "}
          <span className="gradient-text-accent">{session.user.name}</span>
        </h1>
        <p className="text-muted-foreground">Обзор вашей AI платформы</p>
      </div>

      {/* Stats cards */}
      <StatsCards />

      {/* Charts and status row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityChart />
        </div>
        <div>
          <ModelsStatus />
        </div>
      </div>

      {/* Recent generations */}
      <RecentGenerations />
    </div>
  );
}
