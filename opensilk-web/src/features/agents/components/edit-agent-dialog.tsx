import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AgentForm, { type AgentFormValues } from "./agent-form";
import type { Agent } from "../types";

interface EditAgentDialogProps {
  agent: Agent | null;
  isUpdating: boolean;
  onUpdate: (data: { agentId: string } & Partial<AgentFormValues>) => Promise<void>;
  onClose: () => void;
}

export default function EditAgentDialog({
  agent,
  isUpdating,
  onUpdate,
  onClose,
}: EditAgentDialogProps) {
  if (!agent) return null;

  return (
    <Dialog open={!!agent} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          <DialogDescription>Update the agent's persona and settings.</DialogDescription>
        </DialogHeader>
        <AgentForm
          initialValues={{
            name: agent.name,
            slug: agent.slug,
            persona: agent.persona,
            enabled_tools: agent.enabled_tools as string[],
          }}
          isSubmitting={isUpdating}
          onSubmit={async (data) => {
            await onUpdate({ agentId: agent.id, ...data });
            toast.success("Agent updated");
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
