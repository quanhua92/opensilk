import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getAgent, updateAgent as updateAgentFn } from "@/features/agents/server-fns";
import AgentForm from "@/features/agents/components/agent-form";
import type { AgentFormValues } from "@/features/agents/components/agent-form";

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId/agents/$agentId")({
  component: EditAgentPage,
  loader: async ({ params }) => {
    const agent = await getAgent({ data: { workspaceId: params.workspaceId, agentId: params.agentId } });
    return { initialAgent: agent };
  },
});

function EditAgentPage() {
  const { workspaceId, agentId } = Route.useParams();
  const { initialAgent } = Route.useLoaderData();
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSubmit = async (data: AgentFormValues) => {
    setIsUpdating(true);
    try {
      await updateAgentFn({ data: { workspaceId, agentId, ...data } });
      toast.success("Agent updated");
      navigate({ to: "/workspaces/$workspaceId/agents", params: { workspaceId } });
    } catch (err) {
      toast.error("Failed to update agent", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/workspaces/$workspaceId/agents" params={{ workspaceId }}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Agent</h1>
      </div>

      <AgentForm
        initialValues={{
          name: initialAgent.name,
          slug: initialAgent.slug,
          persona: initialAgent.persona,
          enabled_tools: initialAgent.enabled_tools as string[],
        }}
        isSubmitting={isUpdating}
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: "/workspaces/$workspaceId/agents", params: { workspaceId } })}
      />
    </div>
  );
}
