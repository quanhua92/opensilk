import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const createTaskSchema = z.object({
  type: z.enum(["workflow", "agent"]),
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  input_data: z.string().optional(),
});

interface CreateTaskDialogProps {
  isCreating: boolean;
  onCreate: (data: { type: "workflow" | "agent"; name: string; input_data?: Record<string, unknown> }) => Promise<void>;
}

export default function CreateTaskDialog({
  isCreating,
  onCreate,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const form = useForm({
    validators: { onChange: createTaskSchema },
    defaultValues: { type: "workflow" as const, name: "", input_data: "" },
    onSubmit: async ({ value }) => {
      if (value.input_data && value.input_data.trim()) {
        try {
          JSON.parse(value.input_data);
        } catch {
          setJsonError("Invalid JSON");
          return;
        }
      }

      try {
        const parsed = value.input_data?.trim()
          ? JSON.parse(value.input_data)
          : undefined;
        await onCreate({
          type: value.type,
          name: value.name,
          input_data: parsed,
        });
        toast.success("Task created");
        setOpen(false);
        form.reset();
        setJsonError(null);
      } catch (err) {
        toast.error("Failed to create task", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Create a new task in this workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) =>
                    field.handleChange(val as "workflow" | "agent")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workflow">Workflow</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Name</Label>
                <Input
                  id={field.name}
                  placeholder="my-task"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">
                    {typeof field.state.meta.errors[0] === "string"
                      ? field.state.meta.errors[0]
                      : (field.state.meta.errors[0] as { message?: string })?.message || "Validation error"}
                  </p>
                )}
              </div>
            )}
          </form.Field>
          <form.Field name="input_data">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  Input Data (JSON, optional)
                </Label>
                <Textarea
                  id={field.name}
                  placeholder='{"key": "value"}'
                  rows={4}
                  className="font-mono text-sm"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setJsonError(null);
                  }}
                />
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>
            )}
          </form.Field>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
