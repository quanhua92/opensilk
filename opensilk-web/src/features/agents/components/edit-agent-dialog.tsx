import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Agent } from "../types";

interface EditAgentDialogProps {
  agent: Agent | null;
  isUpdating: boolean;
  onUpdate: (data: {
    agentId: string;
    persona?: string;
    name?: string;
    enabled_tools?: string[];
  }) => Promise<void>;
  onClose: () => void;
}

const TOOL_OPTIONS = ["search", "code_review", "web_browse", "file_write"];

export default function EditAgentDialog({
  agent,
  isUpdating,
  onUpdate,
  onClose,
}: EditAgentDialogProps) {
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>([]);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setPersona(agent.persona);
      setEnabledTools(agent.enabled_tools as string[]);
    }
  }, [agent]);

  if (!agent) return null;

  const toggleTool = (tool: string) => {
    setEnabledTools((prev) =>
      prev.includes(tool)
        ? prev.filter((t) => t !== tool)
        : [...prev, tool],
    );
  };

  const handleSubmit = async () => {
    try {
      await onUpdate({
        agentId: agent.id,
        name: name.trim() || undefined,
        persona: persona.trim() || undefined,
        enabled_tools: enabledTools.length > 0 ? enabledTools : undefined,
      });
      toast.success("Agent updated");
    } catch (err) {
      toast.error("Failed to update agent", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          <DialogDescription>Update the agent's persona and settings.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-agent-name">Name</Label>
            <Input
              id="edit-agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-agent-persona">System Prompt / Persona</Label>
            <Textarea
              id="edit-agent-persona"
              rows={4}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Enabled Tools</Label>
            <div className="flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((tool) => (
                <Button
                  key={tool}
                  type="button"
                  size="sm"
                  variant={enabledTools.includes(tool) ? "default" : "outline"}
                  onClick={() => toggleTool(tool)}
                >
                  {tool}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
