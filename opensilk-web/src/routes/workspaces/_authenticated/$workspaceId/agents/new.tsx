import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createAgent as createAgentFn } from "@/features/agents/server-fns";
import AgentForm from "@/features/agents/components/agent-form";
import type { AgentFormValues } from "@/features/agents/components/agent-form";

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId/agents/new")({
  component: CreateAgentPage,
});

function CreateAgentPage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (data: AgentFormValues) => {
    setIsCreating(true);
    try {
      await createAgentFn({ data: { workspaceId, ...data } });
      toast.success("Agent created");
      navigate({ to: "/workspaces/$workspaceId/agents", params: { workspaceId } });
    } catch (err) {
      toast.error("Failed to create agent", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsCreating(false);
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
        <h1 className="text-2xl font-bold tracking-tight">Create Agent</h1>
      </div>

      <AgentForm
        isSubmitting={isCreating}
        onSubmit={handleSubmit}
        onCancel={() => navigate({ to: "/workspaces/$workspaceId/agents", params: { workspaceId } })}
      />
    </div>
  );
}
