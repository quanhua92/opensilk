export type TaskType = "workflow" | "agent";
export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  id: string;
  workspace_id: string;
  type: TaskType;
  name: string;
  status: TaskStatus;
  retry_count: number;
  max_retries: number;
  last_heartbeat_at: string;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  type: TaskType;
  name: string;
  input_data?: Record<string, unknown>;
}
