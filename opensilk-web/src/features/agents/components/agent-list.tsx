import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Agent } from "../types";
import AgentCard from "./agent-card";

interface AgentListProps {
  agents: Agent[];
  isLoading?: boolean;
  workspaceId: string;
  onDelete: (agentId: string) => Promise<void>;
}

export default function AgentList({
  agents,
  isLoading,
  workspaceId,
  onDelete,
}: AgentListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    await onDelete(agent.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={() =>
            navigate({
              to: "/workspaces/$workspaceId/agents/new",
              params: { workspaceId },
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No agents yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() =>
                navigate({
                  to: "/workspaces/$workspaceId/agents/$agentId",
                  params: { workspaceId, agentId: agent.id },
                })
              }
              onDelete={() => handleDelete(agent)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
