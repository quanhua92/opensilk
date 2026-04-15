import { useDroppable } from "@dnd-kit/core";
import type { Card, CardStatus } from "../types";
import KanbanCard from "./kanban-card";

interface KanbanColumnProps {
  status: CardStatus;
  label: string;
  cards: Card[];
  onClickCard: (cardId: string) => void;
}

export default function KanbanColumn({
  status,
  label,
  cards,
  onClickCard,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-lg border bg-muted/30 ${
        isOver ? "ring-2 ring-primary/50" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-muted-foreground text-xs">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {cards.map((card) => (
          <KanbanCard key={card.id} card={card} onClick={() => onClickCard(card.id)} />
        ))}
        {cards.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No cards
          </div>
        )}
      </div>
    </div>
  );
}
