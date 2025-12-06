"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  cancelTask as cancelTaskApi,
  createTask,
  getTaskResult,
  type Task,
  type TaskResult,
  type TaskType,
} from "@/lib/api";
import { useTask } from "./use-task";

type UseTaskMutationOptions = {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Callback when task is created */
  onCreated?: (task: Task) => void;
  /** Callback when task completes successfully */
  onSuccess?: (result: TaskResult) => void;
  /** Callback when task fails */
  onError?: (error: string) => void;
};

/**
 * Hook to create a task and automatically poll for completion.
 *
 * @param taskType - Type of task to create
 * @param options - Configuration options
 * @returns Mutation controls and task state
 */
export function useTaskMutation<TParams extends Record<string, unknown>>(
  taskType: TaskType,
  options: UseTaskMutationOptions = {}
) {
  const { pollInterval = 2000, onCreated, onSuccess, onError } = options;

  const queryClient = useQueryClient();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResult | null>(null);

  // Poll task status
  const {
    task,
    isLoading: isTaskLoading,
    isPolling,
    isPending,
    isProcessing,
    isCompleted,
    isFailed,
    isCancelled,
    isTerminal,
    error: taskError,
  } = useTask(taskId, { pollInterval });

  // Fetch result when completed
  const fetchResult = useCallback(async () => {
    if (!(taskId && isCompleted)) {
      return;
    }

    try {
      const taskResult = await getTaskResult(taskId);
      setResult(taskResult);
      onSuccess?.(taskResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to get result";
      onError?.(message);
    }
  }, [taskId, isCompleted, onSuccess, onError]);

  // Auto-fetch result when completed
  if (isCompleted && !result) {
    fetchResult();
  }

  // Handle failure
  if (isFailed && task?.error) {
    onError?.(task.error);
  }

  // Create task mutation
  const mutation = useMutation({
    mutationFn: async (params: TParams) =>
      createTask({
        type: taskType,
        params,
      }),
    onSuccess: (createdTask) => {
      setTaskId(createdTask.id);
      setResult(null);
      onCreated?.(createdTask);
    },
  });

  // Cancel task mutation
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!taskId) {
        throw new Error("No task to cancel");
      }
      return cancelTaskApi(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  // Reset state
  const reset = useCallback(() => {
    setTaskId(null);
    setResult(null);
    mutation.reset();
    cancelMutation.reset();
  }, [mutation, cancelMutation]);

  return {
    // Mutation controls
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    cancel: cancelMutation.mutate,
    reset,

    // State
    task,
    taskId,
    result,

    // Status flags
    isCreating: mutation.isPending,
    isTaskLoading,
    isPolling,
    isPending,
    isProcessing,
    isCompleted,
    isFailed,
    isCancelled,
    isTerminal,

    // Combined loading state
    isLoading: mutation.isPending || isTaskLoading || isPolling,

    // Errors
    createError: mutation.error,
    taskError,
    cancelError: cancelMutation.error,
  };
}

// Convenience hooks for specific task types
export function useVideoTask(options?: UseTaskMutationOptions) {
  return useTaskMutation<{
    prompt: string;
    image_base64: string;
    num_inference_steps?: number;
    guidance_scale?: number;
    num_frames?: number;
    seed?: number;
  }>("video", options);
}

export function useImageTask(options?: UseTaskMutationOptions) {
  return useTaskMutation<{
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    seed?: number;
    model?: string;
  }>("image", options);
}

export function useImage2ImageTask(options?: UseTaskMutationOptions) {
  return useTaskMutation<{
    prompt: string;
    image_base64: string;
    negative_prompt?: string;
    strength?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    seed?: number;
    model?: string;
  }>("image2image", options);
}

export function useLLMCompareTask(options?: UseTaskMutationOptions) {
  return useTaskMutation<{
    models: string[];
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
  }>("llm_compare", options);
}
