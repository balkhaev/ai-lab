"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Cpu, MemoryStick } from "lucide-react";
import { CardStat } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getModelsList, getQueueStats } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatBytes(mb: number | null): string {
  if (mb === null) {
    return "N/A";
  }
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(0)} MB`;
}

function getGpuIconColor(percent: number): string {
  if (percent >= 90) {
    return "text-red-500";
  }
  if (percent >= 70) {
    return "text-yellow-500";
  }
  return "text-green-500";
}

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof MemoryStick;
  iconColor?: string;
  loading?: boolean;
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  loading,
}: StatCardProps) {
  if (loading) {
    return (
      <CardStat>
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardStat>
    );
  }

  return (
    <CardStat>
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            "bg-primary/10"
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <span className="text-muted-foreground text-xs">{title}</span>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-3xl tracking-tight">{value}</p>
        {subtitle ? (
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        ) : null}
      </div>
    </CardStat>
  );
}

export function StatsCards() {
  // GPU and models data
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: getModelsList,
    refetchInterval: 10_000,
  });

  // Queue stats
  const { data: queueStats, isLoading: queueLoading } = useQuery({
    queryKey: ["queue-stats"],
    queryFn: getQueueStats,
    refetchInterval: 5000,
  });

  const gpuUsagePercent =
    modelsData?.gpu_memory_total_mb && modelsData?.gpu_memory_used_mb
      ? Math.round(
          (modelsData.gpu_memory_used_mb / modelsData.gpu_memory_total_mb) * 100
        )
      : 0;

  const loadedModelsCount =
    modelsData?.models.filter((m) => m.status === "loaded").length ?? 0;

  const activeTasks = queueStats
    ? queueStats.pending + queueStats.processing
    : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* GPU Memory */}
      <StatCard
        icon={MemoryStick}
        iconColor={getGpuIconColor(gpuUsagePercent)}
        loading={modelsLoading}
        subtitle={`${formatBytes(modelsData?.gpu_memory_used_mb ?? null)} / ${formatBytes(modelsData?.gpu_memory_total_mb ?? null)}`}
        title="GPU Память"
        value={`${gpuUsagePercent}%`}
      />

      {/* Active Models */}
      <StatCard
        icon={Cpu}
        iconColor="text-primary"
        loading={modelsLoading}
        subtitle="Загружено в GPU"
        title="Модели"
        value={loadedModelsCount}
      />

      {/* Active Tasks */}
      <StatCard
        icon={Clock}
        iconColor="text-accent"
        loading={queueLoading}
        subtitle={`${queueStats?.processing ?? 0} в обработке`}
        title="В очереди"
        value={activeTasks}
      />

      {/* Processing count */}
      <StatCard
        icon={CheckCircle2}
        iconColor="text-green-500"
        loading={queueLoading}
        subtitle="Задач выполняется"
        title="В обработке"
        value={queueStats?.processing ?? 0}
      />
    </div>
  );
}
