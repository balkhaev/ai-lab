"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Image,
  Layers,
  Loader2,
  MessageSquare,
  Video,
  X,
} from "lucide-react";
import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  cancelTask,
  getQueueStats,
  getTasks,
  type Task,
  type TaskType,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TASK_TYPE_ICONS: Record<TaskType, typeof Video> = {
  video: Video,
  image: Image,
  image2image: Layers,
  llm_compare: MessageSquare,
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  video: "Видео",
  image: "Изображение",
  image2image: "Image2Image",
  llm_compare: "Сравнение LLM",
};

const STATUS_COLORS: Record<Task["status"], string> = {
  pending: "text-muted-foreground",
  processing: "text-primary",
  completed: "text-green-500",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

function TaskItem({
  task,
  onCancel,
}: {
  task: Task;
  onCancel: (taskId: string) => void;
}) {
  const Icon = TASK_TYPE_ICONS[task.type];
  const isActive = task.status === "pending" || task.status === "processing";
  const isProcessing = task.status === "processing";

  return (
    <div className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          isActive ? "bg-primary/10" : "bg-muted"
        )}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Icon
            className={cn(
              "h-4 w-4",
              isActive ? "text-primary" : STATUS_COLORS[task.status]
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-sm">
            {TASK_TYPE_LABELS[task.type]}
          </span>
          {isActive ? (
            <Button
              className="h-6 w-6 shrink-0"
              onClick={() => onCancel(task.id)}
              size="icon"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>

        {/* Status */}
        <div className="mt-1 flex items-center gap-2">
          {task.status === "pending" ? (
            <>
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground text-xs">В очереди</span>
            </>
          ) : null}
          {task.status === "processing" ? (
            <div className="w-full">
              <Progress className="h-1.5" value={task.progress} />
              <span className="mt-1 text-muted-foreground text-xs">
                {Math.round(task.progress)}%
              </span>
            </div>
          ) : null}
          {task.status === "completed" ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-green-600 text-xs">Готово</span>
            </>
          ) : null}
          {task.status === "failed" ? (
            <>
              <AlertCircle className="h-3 w-3 text-destructive" />
              <span className="truncate text-destructive text-xs">
                {task.error || "Ошибка"}
              </span>
            </>
          ) : null}
          {task.status === "cancelled" ? (
            <span className="text-muted-foreground text-xs">Отменено</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TaskQueue() {
  const queryClient = useQueryClient();

  // Fetch queue stats
  const { data: stats } = useQuery({
    queryKey: ["queue-stats"],
    queryFn: getQueueStats,
    refetchInterval: 3000,
  });

  // Fetch recent tasks (we'll use empty user_id to get all recent tasks for now)
  const { data: tasksData } = useQuery({
    queryKey: ["tasks-list"],
    queryFn: () => getTasks(undefined, 10),
    refetchInterval: 2000,
  });

  const tasks = tasksData?.tasks || [];
  const activeTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "processing"
  );
  const recentTasks = tasks.filter(
    (t) => t.status !== "pending" && t.status !== "processing"
  );

  const totalActive = stats
    ? stats.pending + stats.processing
    : activeTasks.length;

  const handleCancel = useCallback(
    async (taskId: string) => {
      try {
        await cancelTask(taskId);
        queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
        queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
      } catch (error) {
        console.error("Failed to cancel task:", error);
      }
    },
    [queryClient]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="relative gap-2" size="sm" variant="outline">
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Очередь</span>
          {totalActive > 0 ? (
            <Badge
              className="-top-1.5 -right-1.5 absolute flex h-5 min-w-5 items-center justify-center p-0 text-xs"
              variant="default"
            >
              {totalActive}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b p-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Очередь задач</h4>
            {stats ? (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <span>{stats.pending} ожидает</span>
                <span>•</span>
                <span>{stats.processing} в работе</span>
              </div>
            ) : null}
          </div>
        </div>

        <ScrollArea className="max-h-80">
          {activeTasks.length > 0 ? (
            <div className="p-2">
              <div className="mb-2 px-2 font-medium text-muted-foreground text-xs">
                Активные
              </div>
              {activeTasks.map((task) => (
                <TaskItem key={task.id} onCancel={handleCancel} task={task} />
              ))}
            </div>
          ) : null}

          {recentTasks.length > 0 ? (
            <div className="border-t p-2">
              <div className="mb-2 px-2 font-medium text-muted-foreground text-xs">
                Недавние
              </div>
              {recentTasks.slice(0, 5).map((task) => (
                <TaskItem key={task.id} onCancel={handleCancel} task={task} />
              ))}
            </div>
          ) : null}

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Layers className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">Нет задач</p>
              <p className="text-muted-foreground/70 text-xs">
                Задачи появятся здесь при генерации
              </p>
            </div>
          ) : null}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
