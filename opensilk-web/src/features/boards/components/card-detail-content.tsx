import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Play } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { PRIORITY_CONFIG, COLUMN_LABELS } from "../types";
import type { Card, CardComment, CardStatus } from "../types";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface CardDetailContentProps {
  card: Card | null;
  comments: CardComment[];
  isLoading: boolean;
  isPosting: boolean;
  isMoving: boolean;
  newComment: string;
  onNewCommentChange: (value: string) => void;
  workspaceId: string;
  boardId: string;
  onMove: (newStatus: CardStatus) => void;
  onComment: () => void;
}

export default function CardDetailContent({
  card,
  comments,
  isLoading,
  isPosting,
  isMoving,
  newComment,
  onNewCommentChange,
  workspaceId,
  boardId,
  onMove,
  onComment,
}: CardDetailContentProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Card not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-bold tracking-tight">{card.title}</h1>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{COLUMN_LABELS[card.status]}</Badge>
        <Badge variant={PRIORITY_CONFIG[card.priority].variant}>
          {PRIORITY_CONFIG[card.priority].label}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {timeAgo(card.created_at)}
        </span>
      </div>

      {/* Move buttons */}
      <div className="flex flex-wrap gap-1">
        {(
          [
            "inbox",
            "planning",
            "ready",
            "in_progress",
            "review",
            "done",
          ] as CardStatus[]
        ).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={card.status === status ? "default" : "outline"}
            disabled={isMoving}
            onClick={() => onMove(status)}
          >
            {COLUMN_LABELS[status]}
          </Button>
        ))}
      </div>

      {/* Execute as Task button */}
      <Button
        size="sm"
        onClick={() =>
          navigate({
            to: "/workspaces/$workspaceId/tasks/new",
            params: { workspaceId },
            search: { card_id: card.id, board_id: boardId },
          })
        }
      >
        <Play className="mr-1 h-4 w-4" />
        Execute as Task
      </Button>

      {/* Description */}
      {card.description && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Description</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {card.description}
          </p>
        </div>
      )}

      {/* Context summary */}
      {card.context_summary && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Context Summary</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {card.context_summary}
          </p>
        </div>
      )}

      <Separator />

      {/* Comments */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">
          Comments ({comments.length})
        </h3>
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-md p-3 text-sm ${
                comment.author_type === "agent"
                  ? "bg-primary/5 border border-primary/20"
                  : "bg-muted"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs">
                  {comment.author_type === "agent" ? "Agent" : "User"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Textarea
            placeholder="Add a comment..."
            rows={3}
            value={newComment}
            onChange={(e) => onNewCommentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                onComment();
              }
            }}
          />
          <Button
            onClick={onComment}
            disabled={isPosting || !newComment.trim()}
            className="self-end"
          >
            {isPosting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
