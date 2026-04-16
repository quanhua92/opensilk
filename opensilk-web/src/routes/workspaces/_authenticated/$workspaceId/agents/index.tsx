import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getAgents, deleteAgent as deleteAgentFn } from "@/features/agents/server-fns";
import AgentList from "@/features/agents/components/agent-list";
import type { Agent } from "@/features/agents/types";

export const Route = createFileRoute(
  "/workspaces/_authenticated/$workspaceId/agents/",
)({
  component: AgentsPage,
  loader: async ({ params }) => {
    return {
      initialAgents: await getAgents({ data: { workspaceId: params.workspaceId } }),
    };
  },
});

function AgentsPage() {
  const { workspaceId } = Route.useParams();
  const { initialAgents } = Route.useLoaderData();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  const handleDelete = async (agentId: string) => {
    await deleteAgentFn({ data: { workspaceId, agentId } });
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
      <AgentList
        agents={agents}
        workspaceId={workspaceId}
        onDelete={handleDelete}
      />
    </div>
  );
}
