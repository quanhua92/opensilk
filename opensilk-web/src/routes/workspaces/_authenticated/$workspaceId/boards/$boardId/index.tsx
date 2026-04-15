import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBoard, getCards, createCard as createCardFn, updateCard as updateCardFn } from "@/features/boards/server-fns";
import KanbanBoard from "@/features/boards/components/kanban-board";
import CreateCardDialog from "@/features/boards/components/create-card-dialog";
import type { Card, CardStatus, Priority } from "@/features/boards/types";

export const Route = createFileRoute(
  "/workspaces/_authenticated/$workspaceId/boards/$boardId/",
)({
  component: BoardDetailPage,
  loader: async ({ params }) => {
    const [board, cards] = await Promise.all([
      getBoard({ data: { workspaceId: params.workspaceId, boardId: params.boardId } }),
      getCards({ data: { workspaceId: params.workspaceId, boardId: params.boardId } }),
    ]);
    return { initialBoard: board, initialCards: cards };
  },
});

function BoardDetailPage() {
  const { workspaceId, boardId } = Route.useParams();
  const { initialBoard, initialCards } = Route.useLoaderData();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [isCreating, setIsCreating] = useState(false);

  const refreshCards = async () => {
    const refreshed = await getCards({
      data: { workspaceId, boardId },
    });
    setCards(refreshed);
  };

  const handleMoveCard = async (cardId: string, newStatus: CardStatus) => {
    await updateCardFn({
      data: { workspaceId, boardId, cardId, status: newStatus },
    });
    await refreshCards();
  };

  const handleCreateCard = async (data: {
    title: string;
    description?: string;
    status?: CardStatus;
    priority?: Priority;
  }) => {
    setIsCreating(true);
    try {
      await createCardFn({
        data: { workspaceId, boardId, ...data },
      });
      await refreshCards();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.history.back()
            }
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {initialBoard.name}
          </h1>
        </div>
        <CreateCardDialog isCreating={isCreating} onCreate={handleCreateCard} />
      </div>

      <KanbanBoard
        cards={cards}
        workspaceId={workspaceId}
        boardId={boardId}
        onMoveCard={handleMoveCard}
        onRefresh={refreshCards}
      />
    </div>
  );
}
