import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getAgents,
  createAgent as createAgentFn,
  updateAgent as updateAgentFn,
  deleteAgent as deleteAgentFn,
} from "@/features/agents/server-fns";
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

  const handleCreate = async (data: {
    name: string;
    slug: string;
    persona: string;
    enabled_tools?: string[];
  }) => {
    const agent = await createAgentFn({ data: { workspaceId, ...data } });
    setAgents((prev) => [...prev, agent]);
  };

  const handleUpdate = async (data: {
    agentId: string;
    persona?: string;
    name?: string;
    enabled_tools?: string[];
  }) => {
    const { agentId, ...agentData } = data;
    const updated = await updateAgentFn({
      data: { workspaceId, agentId, ...agentData },
    });
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? updated : a)),
    );
  };

  const handleDelete = async (agentId: string) => {
    await deleteAgentFn({ data: { workspaceId, agentId } });
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
      <AgentList
        agents={agents}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
