import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTasks } from "@/features/tasks/server-fns";
import { TASK_POLL_INTERVAL_MS } from "@/features/tasks/constants";
import TaskList from "@/features/tasks/components/task-list";
import OverviewStats from "@/features/tasks/components/overview-stats";

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId/tasks/")({
  component: TasksPage,
  loader: async ({ params }) => {
    return {
      initialTasks: await getTasks({ data: { workspaceId: params.workspaceId } }),
    };
  },
});

function TasksPage() {
  const { workspaceId } = Route.useParams();
  const { initialTasks } = Route.useLoaderData();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(initialTasks);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Button
          size="sm"
          onClick={() =>
            navigate({
              to: "/workspaces/$workspaceId/tasks/new",
              params: { workspaceId },
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          New Task
        </Button>
      </div>

      <OverviewStats tasks={tasks} />

      {tasks.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No tasks yet. Create one to get started.
        </div>
      ) : (
        <TaskList tasks={tasks} workspaceId={workspaceId} />
      )}
    </div>
  );
}
