"use client";

import { useQuery } from "@tanstack/react-query";
import { Circle, Cpu, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getModelsList } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatBytes(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GB`;
  }
  return `${mb.toFixed(0)}MB`;
}

export function ModelsStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: getModelsList,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" />
            Модели
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div className="flex items-center gap-3" key={i}>
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const models = data?.models ?? [];
  const loadedModels = models.filter((m) => m.status === "loaded");
  const loadingModels = models.filter(
    (m) => m.status === "loading" || m.status === "unloading"
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-medium text-base">
            <Cpu className="h-4 w-4 text-primary" />
            Активные модели
          </CardTitle>
          <Badge variant="secondary">{loadedModels.length} активно</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[180px] pr-4">
          <div className="space-y-2">
            {loadedModels.length === 0 && loadingModels.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground text-sm">
                Нет загруженных моделей
              </p>
            ) : null}

            {loadingModels.map((model) => (
              <div
                className="flex items-center gap-3 rounded-lg bg-glass-bg/50 px-3 py-2"
                key={model.model_id}
              >
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-yellow-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {model.model_id.split("/").pop()}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {model.status === "loading"
                      ? "Загружается..."
                      : "Выгружается..."}
                  </p>
                </div>
              </div>
            ))}

            {loadedModels.map((model) => (
              <div
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-glass-bg/50"
                key={model.model_id}
              >
                <Circle
                  className={cn(
                    "h-3 w-3 shrink-0 fill-current",
                    "text-green-500"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {model.model_id.split("/").pop()}
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span className="capitalize">{model.model_type}</span>
                    {model.memory_usage_mb ? (
                      <>
                        <span>•</span>
                        <span>{formatBytes(model.memory_usage_mb)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
