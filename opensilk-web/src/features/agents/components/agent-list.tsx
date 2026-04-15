import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Agent } from "../types";
import AgentCard from "./agent-card";
import CreateAgentDialog from "./create-agent-dialog";
import EditAgentDialog from "./edit-agent-dialog";

interface AgentListProps {
  agents: Agent[];
  isLoading?: boolean;
  onCreate: (data: {
    name: string;
    slug: string;
    persona: string;
    enabled_tools?: string[];
  }) => Promise<void>;
  onUpdate: (data: {
    agentId: string;
    persona?: string;
    name?: string;
    enabled_tools?: string[];
  }) => Promise<void>;
  onDelete: (agentId: string) => Promise<void>;
}

export default function AgentList({
  agents,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
}: AgentListProps) {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  const handleUpdate = async (data: {
    agentId: string;
    persona?: string;
    name?: string;
    enabled_tools?: string[];
  }) => {
    setIsUpdating(true);
    try {
      await onUpdate(data);
      setEditingAgent(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    await onDelete(agent.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Agents</h2>
        <CreateAgentDialog
          isCreating={isCreating}
          onCreate={async (data) => {
            setIsCreating(true);
            try {
              await onCreate(data);
            } finally {
              setIsCreating(false);
            }
          }}
        />
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
              onEdit={setEditingAgent}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EditAgentDialog
        agent={editingAgent}
        isUpdating={isUpdating}
        onUpdate={handleUpdate}
        onClose={() => setEditingAgent(null)}
      />
    </div>
  );
}
