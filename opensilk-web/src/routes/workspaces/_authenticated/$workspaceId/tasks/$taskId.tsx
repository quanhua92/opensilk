import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getTask, cancelTask as cancelTaskFn } from "@/features/tasks/server-fns";
import TaskDetail from "@/features/tasks/components/task-detail";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/workspaces/_authenticated/$workspaceId/tasks/$taskId",
)({
  component: TaskDetailPage,
  loader: async ({ params }) => {
    return {
      task: await getTask({
        data: { workspaceId: params.workspaceId, taskId: params.taskId },
      }),
    };
  },
});

function TaskDetailPage() {
  const { workspaceId, taskId } = Route.useParams();
  const { task } = Route.useLoaderData();
  const [currentTask, setCurrentTask] = useState(task);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const updated = await cancelTaskFn({
        data: { workspaceId, taskId },
      });
      setCurrentTask(updated);
      toast.success("Task cancelled");
    } catch (err) {
      toast.error("Failed to cancel task", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <TaskDetail
      task={currentTask}
      workspaceId={workspaceId}
      onCancel={handleCancel}
      isCancelling={isCancelling}
    />
  );
}
