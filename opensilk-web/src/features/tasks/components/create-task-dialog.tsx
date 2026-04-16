import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CreateTaskForm from "./create-task-form";

interface CreateTaskDialogProps {
  workspaceId: string;
  isCreating: boolean;
  onCreate: (data: {
    type: "workflow" | "agentic";
    name: string;
    input_data?: Record<string, unknown>;
  }) => Promise<void>;
  defaultType?: "workflow" | "agentic";
  defaultName?: string;
  cardId?: string;
}

export default function CreateTaskDialog({
  workspaceId,
  isCreating,
  onCreate,
  defaultType,
  defaultName,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Create a new task in this workspace.
          </DialogDescription>
        </DialogHeader>
        <CreateTaskForm
          workspaceId={workspaceId}
          isCreating={isCreating}
          defaultType={defaultType}
          defaultName={defaultName}
          onCreate={async (data) => {
            await onCreate(data);
            toast.success("Task created");
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
