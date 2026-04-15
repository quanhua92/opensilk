import { useState } from "react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Card as CardType, CardStatus, Priority } from "../types";
import { DEFAULT_COLUMNS, COLUMN_LABELS } from "../types";
import KanbanColumn from "./kanban-column";
import CardDetailDialog from "./card-detail-dialog";
import CreateCardDialog from "./create-card-dialog";

interface KanbanBoardProps {
  cards: CardType[];
  workspaceId: string;
  boardId: string;
  onMoveCard: (cardId: string, newStatus: CardStatus) => Promise<void>;
  onRefresh: () => Promise<void>;
  onCreateCard?: (data: {
    title: string;
    description?: string;
    status?: CardStatus;
    priority?: Priority;
  }) => Promise<void>;
  isCreating?: boolean;
}

export default function KanbanBoard({
  cards,
  workspaceId,
  boardId,
  onMoveCard,
  onRefresh,
  onCreateCard,
  isCreating = false,
}: KanbanBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<CardStatus>("inbox");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const cardsByStatus = DEFAULT_COLUMNS.reduce<Record<CardStatus, CardType[]>>(
    (acc, col) => {
      acc[col] = cards
        .filter((c) => c.status === col)
        .sort((a, b) => a.position - b.position);
      return acc;
    },
    {} as Record<CardStatus, CardType[]>,
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const targetStatus = over.id as CardStatus;

    if (!DEFAULT_COLUMNS.includes(targetStatus)) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === targetStatus) return;

    await onMoveCard(cardId, targetStatus);
  };

  const handleAddCard = (status: CardStatus) => {
    setDefaultStatus(status);
    setCreateDialogOpen(true);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 pb-4">
          <SortableContext
            items={DEFAULT_COLUMNS}
            strategy={horizontalListSortingStrategy}
          >
            {DEFAULT_COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                label={COLUMN_LABELS[status]}
                cards={cardsByStatus[status]}
                onClickCard={(id: string) => setSelectedCardId(id)}
                onAddCard={onCreateCard ? handleAddCard : undefined}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      {selectedCardId && (
        <CardDetailDialog
          cardId={selectedCardId}
          workspaceId={workspaceId}
          boardId={boardId}
          onClose={() => setSelectedCardId(null)}
          onRefresh={onRefresh}
        />
      )}

      {onCreateCard && (
        <CreateCardDialog
          isCreating={isCreating}
          defaultStatus={defaultStatus}
          onCreate={onCreateCard}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      )}
    </>
  );
}
