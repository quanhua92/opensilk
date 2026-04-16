import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getCard,
  getComments,
  createComment,
  updateCard,
} from "@/features/boards/server-fns";
import CardDetailContent from "@/features/boards/components/card-detail-content";
import type { Card, CardComment, CardStatus } from "@/features/boards/types";

export const Route = createFileRoute(
  "/workspaces/_authenticated/$workspaceId/boards/$boardId/$cardId",
)({
  component: CardDetailPage,
  loader: async ({ params }) => {
    const [card, comments] = await Promise.all([
      getCard({
        data: {
          workspaceId: params.workspaceId,
          boardId: params.boardId,
          cardId: params.cardId,
        },
      }),
      getComments({
        data: {
          workspaceId: params.workspaceId,
          boardId: params.boardId,
          cardId: params.cardId,
        },
      }),
    ]);
    return { initialCard: card, initialComments: comments };
  },
});

function CardDetailPage() {
  const { workspaceId, boardId, cardId } = Route.useParams();
  const { initialCard, initialComments } = Route.useLoaderData();
  const [card, setCard] = useState<Card | null>(initialCard);
  const [comments, setComments] = useState<CardComment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const handleMove = async (newStatus: CardStatus) => {
    if (!card || card.status === newStatus) return;
    setIsMoving(true);
    try {
      const updated = await updateCard({
        data: { workspaceId, boardId, cardId, status: newStatus },
      });
      setCard(updated);
    } catch {
      toast.error("Failed to move card");
    } finally {
      setIsMoving(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex shrink-0 items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link
            to="/workspaces/$workspaceId/boards/$boardId"
            params={{ workspaceId, boardId }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Board
          </Link>
        </Button>
      </div>

      <div className="max-w-2xl">
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
      </div>
    </div>
  );
}
