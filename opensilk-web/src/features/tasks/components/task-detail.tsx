import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Ban } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { Task } from "../types";
import TaskStatusBadge from "./task-status-badge";

interface TaskDetailProps {
  task: Task;
  workspaceId: string;
  onCancel?: () => void;
  isCancelling?: boolean;
}

function formatJson(data: Record<string, unknown> | null): string {
  if (!data) return "{}";
  return JSON.stringify(data, null, 2);
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TaskDetail({
  task,
  workspaceId,
  onCancel,
  isCancelling,
}: TaskDetailProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: `/workspaces/${workspaceId}` })}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to workspace
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
          <p className="text-muted-foreground text-sm">
            Type: {task.type} &middot; Created{" "}
            {new Date(task.created_at).toLocaleDateString()}
          </p>
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Retries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {task.retry_count} / {task.max_retries}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Heartbeat</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{timeAgo(task.last_heartbeat_at)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {new Date(task.updated_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Input Data</h3>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            <code>{formatJson(task.input_data)}</code>
          </pre>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Output Data</h3>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            <code>{formatJson(task.output_data)}</code>
          </pre>
        </div>
      </div>

      {task.error_log && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-semibold text-destructive">
              Error Log
            </h3>
            <pre className="overflow-auto rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              <code>{task.error_log}</code>
            </pre>
          </div>
        </>
      )}

      {(task.status === "pending" || task.status === "running") && onCancel && (
        <Button
          variant="destructive"
          onClick={onCancel}
          disabled={isCancelling}
        >
          <Ban className="mr-1 h-4 w-4" />
          {isCancelling ? "Cancelling..." : "Cancel Task"}
        </Button>
      )}
    </div>
  );
}

export function TaskDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
