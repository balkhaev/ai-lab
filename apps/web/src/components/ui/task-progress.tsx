"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import type { Task, TaskStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Progress } from "./progress";

type TaskProgressProps = {
  /** Task object from API */
  task: Task | null | undefined;
  /** Whether the task is still being created */
  isCreating?: boolean;
  /** Callback to retry the task */
  onRetry?: () => void;
  /** Callback to cancel the task */
  onCancel?: () => void;
  /** Additional class names */
  className?: string;
  /** Custom messages for different states */
  messages?: {
    creating?: string;
    pending?: string;
    processing?: string;
    completed?: string;
    failed?: string;
    cancelled?: string;
  };
};

const DEFAULT_MESSAGES = {
  creating: "Создание задачи...",
  pending: "В очереди...",
  processing: "Обработка...",
  completed: "Готово!",
  failed: "Ошибка",
  cancelled: "Отменено",
};

const STATUS_ICONS: Record<TaskStatus, typeof Loader2> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: XCircle,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "text-muted-foreground",
  processing: "text-primary",
  completed: "text-green-500",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

/**
 * Universal component for displaying task progress.
 * Shows different states: creating, pending, processing, completed, failed, cancelled.
 */
export function TaskProgress({
  task,
  isCreating = false,
  onRetry,
  onCancel,
  className,
  messages: customMessages,
}: TaskProgressProps) {
  const messages = { ...DEFAULT_MESSAGES, ...customMessages };

  // Creating state
  if (isCreating) {
    return (
      <div className={cn("flex flex-col items-center gap-4 py-6", className)}>
        <div className="relative h-12 w-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        <p className="font-medium text-muted-foreground">{messages.creating}</p>
      </div>
    );
  }

  // No task yet
  if (!task) {
    return null;
  }

  const Icon = STATUS_ICONS[task.status];
  const iconColor = STATUS_COLORS[task.status];
  const isAnimated = task.status === "processing" || task.status === "pending";
  const showProgress = task.status === "processing" && task.progress > 0;
  const showCancel = task.status === "pending" || task.status === "processing";

  return (
    <div className={cn("flex flex-col items-center gap-4 py-6", className)}>
      {/* Icon */}
      <div className="relative">
        {Boolean(isAnimated) && task.status === "processing" ? (
          <div className="absolute inset-0 animate-ping rounded-full border-2 border-primary/30" />
        ) : null}
        <Icon
          className={cn(
            "h-12 w-12",
            iconColor,
            isAnimated ? "animate-spin" : ""
          )}
        />
      </div>

      {/* Status text */}
      <div className="text-center">
        <p className="font-medium">
          {task.status === "pending" && messages.pending}
          {task.status === "processing" && messages.processing}
          {task.status === "completed" && messages.completed}
          {task.status === "failed" && messages.failed}
          {task.status === "cancelled" && messages.cancelled}
        </p>
        {Boolean(task.error) && (
          <p className="mt-1 text-destructive text-sm">{task.error}</p>
        )}
      </div>

      {/* Progress bar */}
      {Boolean(showProgress) && (
        <div className="w-full max-w-xs">
          <Progress className="h-2" value={task.progress} />
          <p className="mt-2 text-center text-muted-foreground text-sm">
            {Math.round(task.progress)}%
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {Boolean(showCancel) && onCancel !== null && onCancel !== undefined ? (
          <Button onClick={onCancel} size="sm" variant="outline">
            Отменить
          </Button>
        ) : null}
        {Boolean(task.status === "failed" && onRetry) && (
          <Button onClick={onRetry} size="sm" variant="default">
            Повторить
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline version for use in cards or lists.
 */
export function TaskProgressInline({
  task,
  isCreating = false,
  className,
}: Pick<TaskProgressProps, "task" | "isCreating" | "className">) {
  if (isCreating) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-muted-foreground text-sm">Создание...</span>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  const Icon = STATUS_ICONS[task.status];
  const iconColor = STATUS_COLORS[task.status];
  const isAnimated = task.status === "processing" || task.status === "pending";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon
        className={cn("h-4 w-4", iconColor, isAnimated ? "animate-spin" : "")}
      />
      <span className="text-sm">
        {task.status === "pending" && "В очереди"}
        {task.status === "processing" && `${Math.round(task.progress)}%`}
        {task.status === "completed" && "Готово"}
        {task.status === "failed" && "Ошибка"}
        {task.status === "cancelled" && "Отменено"}
      </span>
    </div>
  );
}
