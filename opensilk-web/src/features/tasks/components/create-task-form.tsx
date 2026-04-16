import { useState, useEffect, useCallback } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listTaskTypes } from "@/features/tasks/server-fns";
import type { Tool, ListToolsResult } from "@/features/tasks/types";

interface CreateTaskFormProps {
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

const SIMPLE_TYPES = ["string", "number", "integer", "boolean"];

function resolveType(schemaType: unknown): string | null {
  if (typeof schemaType === "string") return schemaType;
  if (Array.isArray(schemaType))
    return schemaType.find((t) => SIMPLE_TYPES.includes(t)) ?? null;
  return null;
}

function isSimpleSchema(schema: Tool["inputSchema"]): boolean {
  if (!schema.properties || typeof schema.properties !== "object") return false;
  return Object.entries(schema.properties).every(
    ([, val]) =>
      val !== null &&
      typeof val === "object" &&
      "type" in val &&
      resolveType((val as { type: unknown }).type) !== null,
  );
}

function SchemaField({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: { type?: unknown; description?: string; default?: unknown };
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const type = resolveType(schema.type) || "string";
  const description = schema.description;
  const label = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <input
          id={name}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor={name} className="!mt-0">
          {label}
          {description && (
            <span className="ml-1 text-muted-foreground">— {description}</span>
          )}
        </Label>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {description && (
          <span className="ml-1 text-muted-foreground">— {description}</span>
        )}
      </Label>
      <Input
        id={name}
        type={type === "number" || type === "integer" ? "number" : "text"}
        step={type === "integer" ? "1" : undefined}
        placeholder={schema.default !== undefined ? String(schema.default) : ""}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => {
          if (type === "number" || type === "integer") {
            onChange(e.target.value === "" ? undefined : Number(e.target.value));
          } else {
            onChange(e.target.value || undefined);
          }
        }}
      />
    </div>
  );
}

export default function CreateTaskForm({
  workspaceId,
  isCreating,
  onCreate,
  defaultType,
  defaultName,
}: CreateTaskFormProps) {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [selectedToolName, setSelectedToolName] = useState("");
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      type: (defaultType ?? "workflow") as "workflow" | "agentic",
      name: (defaultName ?? "") as string,
      input_data: undefined as Record<string, unknown> | undefined,
    },
    onSubmit: async ({ value }) => {
      try {
        const selectedTool = tools.find((t) => t.name === value.name);
        const useSimple = selectedTool ? isSimpleSchema(selectedTool.inputSchema) : false;
        let inputData: Record<string, unknown> | undefined;
        if (useSimple) {
          inputData = Object.keys(inputValues).length > 0 ? inputValues : undefined;
        } else if (jsonInput.trim()) {
          try {
            inputData = JSON.parse(jsonInput);
          } catch {
            setJsonError("Invalid JSON");
            return;
          }
        }
        await onCreate({
          type: value.type,
          name: value.name,
          input_data: inputData,
        });
      } catch (err) {
        toast.error("Failed to create task", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
  });

  const fetchTools = useCallback(
    async (type: "workflow" | "agentic") => {
      setLoadingTools(true);
      try {
        const result: ListToolsResult =
          await listTaskTypes({ data: { workspaceId, type } });
        setTools(result.tools);
      } catch {
        setTools([]);
        toast.error("Failed to load tools");
      } finally {
        setLoadingTools(false);
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    fetchTools(form.state.values.type);
  }, [form.state.values.type, fetchTools]);

  const selectedTool = tools.find((t) => t.name === selectedToolName);
  const hasSimpleSchema = selectedTool
    ? isSimpleSchema(selectedTool.inputSchema)
    : false;

  const updateInputValue = (key: string, val: unknown) => {
    setInputValues((prev) => {
      const next = { ...prev };
      if (val === undefined) delete next[key];
      else next[key] = val;
      return next;
    });
  };

  const handleTypeChange = (val: string) => {
    form.setFieldValue("type", val as "workflow" | "agentic");
    form.setFieldValue("name", "");
    form.setFieldValue("input_data", undefined);
    setSelectedToolName("");
    setInputValues({});
    setJsonInput("");
  };

  const handleToolChange = (val: string) => {
    form.setFieldValue("name", val);
    form.setFieldValue("input_data", undefined);
    setSelectedToolName(val);
    setInputValues({});
    setJsonInput("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-6 max-w-2xl"
    >
      {/* Type selector */}
      <form.Field name="type">
        {(field) => (
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={field.state.value}
              onValueChange={handleTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="agentic">Agentic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      {/* Tool name selector */}
      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label>Tool</Label>
            {loadingTools ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tools...
              </div>
            ) : (
              <Select
                value={field.state.value}
                onValueChange={handleToolChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((tool) => (
                    <SelectItem key={tool.name} value={tool.name}>
                      {tool.annotations?.title || tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedTool?.description && (
              <p className="text-sm text-muted-foreground">
                {selectedTool.description}
              </p>
            )}
          </div>
        )}
      </form.Field>

      {/* Dynamic inputs from tool schema */}
      {selectedTool && hasSimpleSchema && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Parameters</Label>
          {Object.entries(selectedTool.inputSchema.properties ?? {}).map(
            ([key, propSchema]) => (
              <SchemaField
                key={key}
                name={key}
                schema={propSchema as {
                  type?: string;
                  description?: string;
                  default?: unknown;
                }}
                value={inputValues[key]}
                onChange={(val) => updateInputValue(key, val)}
              />
            ),
          )}
        </div>
      )}

      {/* Fallback: raw JSON textarea for complex schemas */}
      {selectedTool &&
        !hasSimpleSchema &&
        selectedTool.inputSchema.properties &&
        Object.keys(selectedTool.inputSchema.properties).length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Input Data (JSON, optional)
            </Label>
            <Textarea
              placeholder='{"key": "value"}'
              rows={6}
              className="font-mono text-sm"
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setJsonError(null);
              }}
            />
            {jsonError && (
              <p className="text-sm text-destructive">{jsonError}</p>
            )}
          </div>
        )}

      <div className="flex justify-end gap-2">
        <form.Field name="name">
          {(field) => (
            <Button
              type="submit"
              disabled={isCreating || !field.state.value || loadingTools}
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
          )}
        </form.Field>
      </div>
    </form>
  );
}
