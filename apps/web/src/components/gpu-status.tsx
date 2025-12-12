"use client";

import { useQuery } from "@tanstack/react-query";
import { Cpu, MemoryStick } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getModelsList } from "@/lib/api";
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

export function GpuStatus() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["models"],
    queryFn: getModelsList,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="liquid-glass-subtle flex h-8 items-center gap-2 rounded-xl px-3">
        <MemoryStick className="h-4 w-4 animate-pulse text-muted-foreground" />
        <span className="font-mono text-muted-foreground text-xs">...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-8 items-center gap-2 rounded-xl bg-destructive/10 px-3">
              <MemoryStick className="h-4 w-4 text-destructive" />
              <span className="font-mono text-destructive text-xs">—</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Не удалось получить данные GPU</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const {
    gpu_memory_total_mb,
    gpu_memory_used_mb,
    gpu_memory_free_mb,
    models,
  } = data;

  const usagePercent =
    gpu_memory_total_mb && gpu_memory_used_mb
      ? Math.round((gpu_memory_used_mb / gpu_memory_total_mb) * 100)
      : 0;

  const loadedModelsCount = models.filter((m) => m.status === "loaded").length;
  const loadingModelsCount = models.filter(
    (m) => m.status === "loading" || m.status === "unloading"
  ).length;

  const getStatusColor = () => {
    if (usagePercent >= 90) {
      return "text-red-500";
    }
    if (usagePercent >= 70) {
      return "text-yellow-500";
    }
    return "text-green-500";
  };

  const getBarColor = () => {
    if (usagePercent >= 90) {
      return "bg-red-500";
    }
    if (usagePercent >= 70) {
      return "bg-yellow-500";
    }
    return "bg-green-500";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="liquid-glass-subtle flex h-8 cursor-default items-center gap-2 rounded-xl px-3 transition-colors hover:bg-glass-bg-hover">
            <MemoryStick className={cn("h-4 w-4", getStatusColor())} />
            <div className="flex items-center gap-2">
              {/* Mini progress bar */}
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted/50">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    getBarColor()
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <span className="font-mono text-xs">
                <span className={getStatusColor()}>{usagePercent}%</span>
              </span>
            </div>
            {/* Models count */}
            {(loadedModelsCount > 0 || loadingModelsCount > 0) && (
              <div className="flex items-center gap-1 border-glass-border/50 border-l pl-2">
                <Cpu className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-muted-foreground text-xs">
                  {loadedModelsCount}
                  {loadingModelsCount > 0 && (
                    <span className="text-yellow-500">
                      +{loadingModelsCount}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="liquid-glass-strong max-w-xs" side="bottom">
          <div className="space-y-2">
            <div className="font-medium">GPU Память</div>
            <div className="text-muted-foreground text-xs">
              Использовано: {formatBytes(gpu_memory_used_mb)} /{" "}
              {formatBytes(gpu_memory_total_mb)}
            </div>
            <div className="text-muted-foreground text-xs">
              Свободно: {formatBytes(gpu_memory_free_mb)}
            </div>
            <div className="border-glass-border/50 border-t pt-2 text-muted-foreground text-xs">
              Активных моделей: {loadedModelsCount}
              {loadingModelsCount > 0 && ` (+${loadingModelsCount} в процессе)`}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
