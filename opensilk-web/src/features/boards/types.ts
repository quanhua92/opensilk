export type CardStatus =
  | "inbox"
  | "planning"
  | "ready"
  | "in_progress"
  | "review"
  | "done";

export type Priority = "none" | "low" | "medium" | "high" | "urgent";

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  column_config: string[];
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  board_id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: CardStatus;
  assigned_agent_id: string | null;
  priority: Priority;
  context_summary: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CardAgent {
  agent_id: string;
  card_id: string;
  role: string;
  created_at: string;
}

export interface CardComment {
  id: string;
  card_id: string;
  author_type: "user" | "agent";
  author_id: string;
  content: string;
  created_at: string;
}

export interface CardAttachment {
  id: string;
  card_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface CreateBoardRequest {
  name: string;
  description?: string;
}

export interface CreateCardRequest {
  title: string;
  description?: string;
  status?: CardStatus;
  assigned_agent_id?: string;
  priority?: Priority;
}

export interface CreateCommentRequest {
  content: string;
}

export interface CreateAttachmentRequest {
  file_name: string;
  file_url: string;
  file_size?: number;
  content_type?: string;
}

export const DEFAULT_COLUMNS: CardStatus[] = [
  "inbox",
  "planning",
  "ready",
  "in_progress",
  "review",
  "done",
];

export const COLUMN_LABELS: Record<CardStatus, string> = {
  inbox: "Inbox",
  planning: "Planning",
  ready: "Ready",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  none: { label: "None", variant: "outline" },
  low: { label: "Low", variant: "secondary" },
  medium: { label: "Medium", variant: "default" },
  high: { label: "High", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};
