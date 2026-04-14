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
import { createWorkspace } from "../server-fns";
import { useWorkspaces } from "../context";

const workspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

export default function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const { workspaces, setWorkspaces } = useWorkspaces();

  const form = useForm({
    validators: { onChange: workspaceSchema },
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      try {
        const newWorkspace = await createWorkspace({ data: value });
        setWorkspaces([...workspaces, newWorkspace]);
        toast.success("Workspace created");
        setOpen(false);
        form.reset();
      } catch (err) {
        toast.error("Failed to create workspace", {
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
          New Workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Enter a name for your new workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Name</Label>
                <Input
                  id={field.name}
                  placeholder="My Workspace"
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
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
