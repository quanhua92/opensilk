import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createTask as createTaskFn } from "@/features/tasks/server-fns";
import CreateTaskForm from "@/features/tasks/components/create-task-form";

const searchSchema = {
  card_id: "",
  board_id: "",
};

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId/tasks/new")({
  component: CreateTaskPage,
  validateSearch: searchSchema,
});

function CreateTaskPage() {
  const { workspaceId } = Route.useParams();
  const { card_id } = useSearch({ from: "/workspaces/_authenticated/$workspaceId/tasks/new" });
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (data: {
    type: "workflow" | "agentic";
    name: string;
    input_data?: Record<string, unknown>;
  }) => {
    setIsCreating(true);
    try {
      await createTaskFn({
        data: {
          workspaceId,
          ...data,
          ...(card_id ? { card_id } : {}),
        },
      });
      toast.success("Task created");
      navigate({ to: "/workspaces/$workspaceId/tasks", params: { workspaceId } });
    } catch (err) {
      toast.error("Failed to create task", {
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
          <Link to="/workspaces/$workspaceId/tasks" params={{ workspaceId }}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Task</h1>
      </div>

      <CreateTaskForm
        workspaceId={workspaceId}
        isCreating={isCreating}
        onCreate={handleCreate}
      />
    </div>
  );
}
