import { useState, useCallback } from "react";
import type { Task, TaskStatus } from "../types";

export function useTaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async (fetchFn: () => Promise<Task[]>) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFn();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { tasks, setTasks, isLoading, error, fetchTasks };
}

export function useCreateTask() {
  const [isCreating, setIsCreating] = useState(false);

  const create = useCallback(
    async (createFn: () => Promise<Task>) => {
      setIsCreating(true);
      try {
        return await createFn();
      } finally {
        setIsCreating(false);
      }
    },
    [],
  );

  return { createTask: create, isCreating };
}

export function useCancelTask() {
  const [isCancelling, setIsCancelling] = useState(false);

  const cancel = useCallback(
    async (cancelFn: () => Promise<Task>) => {
      setIsCancelling(true);
      try {
        return await cancelFn();
      } finally {
        setIsCancelling(false);
      }
    },
    [],
  );

  return { cancelTask: cancel, isCancelling };
}
