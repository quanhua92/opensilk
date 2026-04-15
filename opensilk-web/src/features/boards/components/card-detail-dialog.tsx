import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getComments, createComment, getCard, updateCard } from "../server-fns";
import { PRIORITY_CONFIG, COLUMN_LABELS } from "../types";
import type { Card, CardComment, CardStatus } from "../types";

interface CardDetailDialogProps {
  cardId: string;
  workspaceId: string;
  boardId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

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

export default function CardDetailDialog({
  cardId,
  workspaceId,
  boardId,
  onClose,
  onRefresh,
}: CardDetailDialogProps) {
  const [card, setCard] = useState<Card | null>(null);
  const [comments, setComments] = useState<CardComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [c, comms] = await Promise.all([
          getCard({ data: { workspaceId, boardId, cardId } }),
          getComments({ data: { workspaceId, boardId, cardId } }),
        ]);
        setCard(c);
        setComments(comms);
      } catch {
        toast.error("Failed to load card");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [cardId, workspaceId, boardId]);

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setIsPosting(true);
    try {
      const comment = await createComment({
        data: { workspaceId, boardId, cardId, content: newComment.trim() },
      });
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setIsPosting(false);
    }
  };

  const handleMove = async (newStatus: CardStatus) => {
    if (!card || card.status === newStatus) return;
    setIsMoving(true);
    try {
      const updated = await updateCard({
        data: { workspaceId, boardId, cardId, status: newStatus },
      });
      setCard(updated);
      await onRefresh();
    } catch {
      toast.error("Failed to move card");
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={!!cardId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {card?.title ?? "Loading..."}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20" />
            <Skeleton className="h-40" />
          </div>
        ) : card ? (
          <div className="space-y-4">
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
                  onClick={() => handleMove(status)}
                >
                  {COLUMN_LABELS[status]}
                </Button>
              ))}
            </div>

            {/* Description */}
            {card.description && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {card.description}
                </p>
              </div>
            )}

            {/* Context summary */}
            {card.context_summary && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Context Summary</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {card.context_summary}
                </p>
              </div>
            )}

            <Separator />

            {/* Comments */}
            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Comments ({comments.length})
              </h4>
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`rounded-md p-2 text-sm ${
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
              <div className="mt-3 flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  rows={2}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleComment}
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
