/**
 * Task queue types for async operations.
 */

export type TaskType =
  | "video"
  | "image"
  | "image2image"
  | "image_to_3d"
  | "llm_compare";

export type TaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type Task = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type TaskResult = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  result: Record<string, unknown> | null;
  error: string | null;
};

export type TaskListResponse = {
  tasks: Task[];
  total: number;
};

export type QueueStats = {
  pending: number;
  processing: number;
};

export type CreateTaskParams = {
  type: TaskType;
  params: Record<string, unknown>;
  user_id?: string;
};
