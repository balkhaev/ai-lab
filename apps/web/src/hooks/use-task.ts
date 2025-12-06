"use client";

import { useQuery } from "@tanstack/react-query";
import { getTask, type TaskStatus } from "@/lib/api";

type UseTaskOptions = {
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
};

const TERMINAL_STATUSES: TaskStatus[] = ["completed", "failed", "cancelled"];

/**
 * Hook to poll task status until it reaches a terminal state.
 *
 * @param taskId - ID of the task to poll (null to disable)
 * @param options - Configuration options
 * @returns Task status and query state
 */
export function useTask(taskId: string | null, options: UseTaskOptions = {}) {
  const { pollInterval = 2000, enabled = true } = options;

  const query = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => (taskId ? getTask(taskId) : null),
    enabled: enabled && taskId !== null,
    refetchInterval: (queryState) => {
      // Stop polling when task reaches terminal state
      const taskData = queryState.state.data;
      if (taskData && TERMINAL_STATUSES.includes(taskData.status)) {
        return false;
      }
      return pollInterval;
    },
    staleTime: 0, // Always refetch
  });

  const task = query.data;

  return {
    task,
    isLoading: query.isLoading,
    isPolling: query.isFetching && !query.isLoading,
    isPending: task?.status === "pending",
    isProcessing: task?.status === "processing",
    isCompleted: task?.status === "completed",
    isFailed: task?.status === "failed",
    isCancelled: task?.status === "cancelled",
    isTerminal: task ? TERMINAL_STATUSES.includes(task.status) : false,
    error: query.error,
    refetch: query.refetch,
  };
}
