import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreateAgentDialogProps {
  workspaceId: string;
  isCreating: boolean;
  onCreate: (data: {
    name: string;
    slug: string;
    persona: string;
    enabled_tools?: string[];
  }) => Promise<void>;
}

const TOOL_OPTIONS = ["search", "code_review", "web_browse", "file_write"];

export default function CreateAgentDialog({
  isCreating,
  onCreate,
}: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [persona, setPersona] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>([]);

  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === autoSlug(name)) {
      setSlug(autoSlug(value));
    }
  };

  const toggleTool = (tool: string) => {
    setEnabledTools((prev) =>
      prev.includes(tool)
        ? prev.filter((t) => t !== tool)
        : [...prev, tool],
    );
  };

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim()) return;
    try {
      await onCreate({
        name: name.trim(),
        slug: slug.trim(),
        persona: persona.trim(),
        enabled_tools: enabledTools.length > 0 ? enabledTools : undefined,
      });
      toast.success("Agent created");
      setOpen(false);
      setName("");
      setSlug("");
      setPersona("");
      setEnabledTools([]);
    } catch (err) {
      toast.error("Failed to create agent", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setName("");
          setSlug("");
          setPersona("");
          setEnabledTools([]);
        }
      }}
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
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. OpenClaw Research"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent-slug">Slug</Label>
            <Input
              id="agent-slug"
              placeholder="e.g. openclaw-research"
              className="font-mono text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agent-persona">System Prompt / Persona</Label>
            <Textarea
              id="agent-persona"
              placeholder="You are a helpful research assistant..."
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || !name.trim() || !slug.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
