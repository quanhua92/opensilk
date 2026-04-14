import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task } from "../types";
import TaskStatusBadge from "./task-status-badge";

interface TaskListProps {
  tasks: Task[];
  workspaceId: string;
}

export default function TaskList({ tasks, workspaceId }: TaskListProps) {
  const navigate = useNavigate();

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[80px]">Retries</TableHead>
            <TableHead className="w-[130px]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer"
              onClick={() =>
                navigate({
                  to: `/workspaces/${workspaceId}/tasks/${task.id}`,
                })
              }
            >
              <TableCell className="font-medium">{task.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{task.type}</Badge>
              </TableCell>
              <TableCell>
                <TaskStatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                {task.retry_count}/{task.max_retries}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(task.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
