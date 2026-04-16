import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TOOL_OPTIONS = ["search", "code_review", "web_browse", "file_write"];

export interface AgentFormValues {
  name: string;
  slug: string;
  persona: string;
  enabled_tools: string[];
}

interface AgentFormProps {
  initialValues?: Partial<AgentFormValues>;
  isSubmitting: boolean;
  onSubmit: (data: AgentFormValues) => Promise<void>;
  onCancel?: () => void;
}

export default function AgentForm({
  initialValues,
  isSubmitting,
  onSubmit,
  onCancel,
}: AgentFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [persona, setPersona] = useState(initialValues?.persona ?? "");
  const [enabledTools, setEnabledTools] = useState<string[]>(
    initialValues?.enabled_tools ?? [],
  );

  const isEdit = !!initialValues;

  const autoSlug = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isEdit && (!slug || slug === autoSlug(name))) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || (!isEdit && !slug.trim())) return;
    try {
      await onSubmit({
        name: name.trim(),
        slug: slug.trim(),
        persona: persona.trim(),
        enabled_tools: enabledTools,
      });
    } catch (err) {
      toast.error(`Failed to ${isEdit ? "update" : "create"} agent`, {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-1.5">
        <Label htmlFor="agent-name">Name</Label>
        <Input
          id="agent-name"
          placeholder="e.g. OpenClaw Research"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      {!isEdit && (
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
      )}

      <div className="space-y-1.5">
        <Label htmlFor="agent-persona">System Prompt / Persona</Label>
        <Textarea
          id="agent-persona"
          placeholder="You are a helpful research assistant..."
          rows={12}
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          className="font-mono text-sm"
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

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !name.trim() || (!isEdit && !slug.trim())}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              {isEdit ? "Saving..." : "Creating..."}
            </>
          ) : (
            isEdit ? "Save" : "Create"
          )}
        </Button>
      </div>
    </form>
  );
}
