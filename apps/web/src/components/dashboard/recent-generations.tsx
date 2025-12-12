"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CheckCircle2,
  Clock,
  Image,
  Layers,
  Loader2,
  MessageSquare,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTasks, type Task, type TaskType } from "@/lib/api";
import { cn } from "@/lib/utils";

const TASK_TYPE_ICONS: Record<TaskType, typeof Video> = {
  video: Video,
  image: Image,
  image2image: Layers,
  image_to_3d: Box,
  llm_compare: MessageSquare,
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  video: "Видео",
  image: "Изображение",
  image2image: "Image2Image",
  image_to_3d: "3D",
  llm_compare: "LLM",
};

const TASK_TYPE_HREF: Record<TaskType, string> = {
  video: "/video",
  image: "/image",
  image2image: "/image",
  image_to_3d: "/3d",
  llm_compare: "/chat",
};

function getStatusVariant(
  status: Task["status"]
): "default" | "destructive" | "secondary" {
  if (status === "completed") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "secondary";
}

function TaskStatusIcon({ status }: { status: Task["status"] }) {
  switch (status) {
    case "pending":
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "processing":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "cancelled":
      return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return null;
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) {
    return "только что";
  }
  if (diffMins < 60) {
    return `${diffMins} мин назад`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} ч назад`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} д назад`;
}

export function RecentGenerations() {
  const { data, isLoading } = useQuery({
    queryKey: ["tasks-list"],
    queryFn: () => getTasks(undefined, 10),
    refetchInterval: 5000,
  });

  const tasks = data?.tasks ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Недавние генерации</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div className="flex items-center gap-4" key={i}>
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-medium text-base">
            Недавние генерации
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/models">Все задачи</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Layers className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="mb-1 text-muted-foreground">Нет генераций</p>
            <p className="text-muted-foreground/70 text-sm">
              Создайте первую генерацию
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 6).map((task) => {
              const Icon = TASK_TYPE_ICONS[task.type];
              const isActive =
                task.status === "pending" || task.status === "processing";

              return (
                <Link
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    "hover:bg-glass-bg/50"
                  )}
                  href={TASK_TYPE_HREF[task.type]}
                  key={task.id}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      isActive ? "bg-primary/10" : "bg-muted/50"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {TASK_TYPE_LABELS[task.type]}
                      </span>
                      <TaskStatusIcon status={task.status} />
                    </div>
                    <p className="truncate text-muted-foreground text-xs">
                      {formatTimeAgo(task.created_at)}
                    </p>
                  </div>

                  <Badge
                    className="shrink-0"
                    variant={getStatusVariant(task.status)}
                  >
                    {task.status === "pending" && "В очереди"}
                    {task.status === "processing" &&
                      `${Math.round(task.progress)}%`}
                    {task.status === "completed" && "Готово"}
                    {task.status === "failed" && "Ошибка"}
                    {task.status === "cancelled" && "Отменено"}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
