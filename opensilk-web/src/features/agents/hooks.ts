import { useState, useCallback } from "react";
import type { Agent } from "../types";

export function useAgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(
    async (fetchFn: () => Promise<Agent[]>) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchFn();
        setAgents(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load agents",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { agents, setAgents, isLoading, error, fetchAgents };
}
