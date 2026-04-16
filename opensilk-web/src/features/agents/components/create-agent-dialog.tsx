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
import AgentForm, { type AgentFormValues } from "./agent-form";

interface CreateAgentDialogProps {
  isCreating: boolean;
  onCreate: (data: AgentFormValues) => Promise<void>;
}

export default function CreateAgentDialog({
  isCreating,
  onCreate,
}: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Agent</DialogTitle>
          <DialogDescription>
            Create a new AI agent persona for this workspace.
          </DialogDescription>
        </DialogHeader>
        <AgentForm
          isSubmitting={isCreating}
          onSubmit={async (data) => {
            await onCreate(data);
            toast.success("Agent created");
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
