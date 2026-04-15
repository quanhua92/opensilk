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
import type { Card as CardType, CardStatus } from "../types";
import { DEFAULT_COLUMNS, COLUMN_LABELS } from "../types";
import KanbanColumn from "./kanban-column";
import CardDetailDialog from "./card-detail-dialog";

interface KanbanBoardProps {
  cards: CardType[];
  workspaceId: string;
  boardId: string;
  onMoveCard: (cardId: string, newStatus: CardStatus) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export default function KanbanBoard({
  cards,
  workspaceId,
  boardId,
  onMoveCard,
  onRefresh,
}: KanbanBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
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
    </>
  );
}
