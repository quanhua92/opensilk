import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ListTodo,
  Bot,
  LayoutDashboard,
  Clock,
  Play,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTasks } from "@/features/tasks/server-fns";
import { getAgents } from "@/features/agents/server-fns";
import { getBoards } from "@/features/boards/server-fns";

export const Route = createFileRoute("/workspaces/_authenticated/$workspaceId/")({
  component: WorkspaceDetailPage,
  loader: async ({ params }) => {
    const [tasks, agents, boards] = await Promise.all([
      getTasks({ data: { workspaceId: params.workspaceId } }),
      getAgents({ data: { workspaceId: params.workspaceId } }),
      getBoards({ data: { workspaceId: params.workspaceId } }),
    ]);
    return { initialTasks: tasks, agents, boards };
  },
});

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams();
  const { initialTasks, agents, boards } = Route.useLoaderData();

  const pendingCount = initialTasks.filter((t) => t.status === "pending").length;
  const runningCount = initialTasks.filter((t) => t.status === "running").length;
  const completedCount = initialTasks.filter((t) => t.status === "completed").length;
  const failedCount = initialTasks.filter((t) => t.status === "failed").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Workspace: {workspaceId.slice(0, 8)}...
      </h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-muted-foreground text-xs">tasks waiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningCount}</div>
            <p className="text-muted-foreground text-xs">tasks active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-muted-foreground text-xs">tasks done</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-muted-foreground text-xs">tasks errored</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/workspaces/$workspaceId/tasks"
          params={{ workspaceId }}
          className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <ListTodo className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Tasks</p>
            <p className="text-muted-foreground text-sm">
              {initialTasks.length} total tasks
            </p>
          </div>
        </Link>
        <Link
          to="/workspaces/$workspaceId/agents"
          params={{ workspaceId }}
          className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
        >
          <Bot className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Agents</p>
            <p className="text-muted-foreground text-sm">
              {agents.length} agent{agents.length !== 1 ? "s" : ""} configured
            </p>
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
            <p className="text-muted-foreground text-sm">
              {boards.length} board{boards.length !== 1 ? "s" : ""}
            </p>
          </div>
        </Link>
      </div>

      {/* Recent tasks */}
      {initialTasks.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Tasks</h2>
            <Link
              to="/workspaces/$workspaceId/tasks"
              params={{ workspaceId }}
              className="text-muted-foreground text-sm hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {initialTasks.slice(0, 5).map((task) => (
              <Link
                key={task.id}
                to="/workspaces/$workspaceId/tasks/$taskId"
                params={{ workspaceId, taskId: task.id }}
                className="flex items-center justify-between rounded-md border px-4 py-2 transition-colors hover:bg-muted/50"
              >
                <span className="text-sm font-medium">{task.name}</span>
                <span className="text-muted-foreground text-xs">{task.status}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
