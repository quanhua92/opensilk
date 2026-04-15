import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, LayoutDashboard } from "lucide-react";
import { getTasks, createTask as createTaskFn } from "@/features/tasks/server-fns";
import { TASK_POLL_INTERVAL_MS } from "@/features/tasks/constants";
import TaskList from "@/features/tasks/components/task-list";
import CreateTaskDialog from "@/features/tasks/components/create-task-dialog";
import OverviewStats from "@/features/tasks/components/overview-stats";

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId/")({
  component: WorkspaceDetailPage,
  loader: async ({ params }) => {
    return {
      initialTasks: await getTasks({ data: { workspaceId: params.workspaceId } }),
    };
  },
});

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams();
  const { initialTasks } = Route.useLoaderData();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreating, setIsCreating] = useState(false);

  const hasActiveTasks = tasks.some(
    (t) => t.status === "pending" || t.status === "running",
  );

  useEffect(() => {
    if (!hasActiveTasks) return;

    const interval = setInterval(async () => {
      const refreshed = await getTasks({ data: { workspaceId } });
      setTasks(refreshed);
    }, TASK_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasActiveTasks, workspaceId]);

  const handleCreateTask = async (data: {
    type: "workflow" | "agentic";
    name: string;
    input_data?: Record<string, unknown>;
  }) => {
    setIsCreating(true);
    try {
      await createTaskFn({
        data: { workspaceId, ...data },
      });
      const refreshed = await getTasks({ data: { workspaceId } });
      setTasks(refreshed);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Workspace: {workspaceId.slice(0, 8)}...
        </h1>
        <CreateTaskDialog workspaceId={workspaceId} isCreating={isCreating} onCreate={handleCreateTask} />
      </div>

      <OverviewStats tasks={tasks} />

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/workspaces/$workspaceId/agents"
          params={{ workspaceId }}
          className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <Bot className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Agents</p>
            <p className="text-muted-foreground text-sm">Manage AI agent personas</p>
          </div>
        </Link>
        <Link
          to="/workspaces/$workspaceId/boards"
          params={{ workspaceId }}
          className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Boards</p>
            <p className="text-muted-foreground text-sm">Kanban boards with cards</p>
          </div>
        </Link>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tasks</h2>
        {tasks.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No tasks yet. Create one to get started.
          </div>
        ) : (
          <TaskList tasks={tasks} workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
