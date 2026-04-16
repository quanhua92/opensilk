import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getComments, createComment, getCard, updateCard } from "../server-fns";
import type { Card, CardComment, CardStatus } from "../types";
import CardDetailContent from "./card-detail-content";

interface CardDetailDialogProps {
  cardId: string | null;
  workspaceId: string;
  boardId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
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
    if (!cardId) return;
    async function load() {
      setIsLoading(true);
      try {
        const cid = cardId;
        const [c, comms] = await Promise.all([
          getCard({ data: { workspaceId, boardId, cardId: cid } }),
          getComments({ data: { workspaceId, boardId, cardId: cid } }),
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
    if (!newComment.trim() || !cardId) return;
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
    if (!card || card.status === newStatus || !cardId) return;
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
          <DialogTitle>{card?.title ?? "Loading..."}</DialogTitle>
        </DialogHeader>
        <CardDetailContent
          card={card}
          comments={comments}
          isLoading={isLoading}
          isPosting={isPosting}
          isMoving={isMoving}
          newComment={newComment}
          onNewCommentChange={setNewComment}
          workspaceId={workspaceId}
          boardId={boardId}
          onMove={handleMove}
          onComment={handleComment}
        />
      </DialogContent>
    </Dialog>
  );
}
