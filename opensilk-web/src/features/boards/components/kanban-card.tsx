import { Link } from "@tanstack/react-router";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_CONFIG } from "../types";
import type { Card } from "../types";

interface KanbanCardProps {
  card: Card;
  workspaceId: string;
  boardId: string;
}

export default function KanbanCard({ card, workspaceId, boardId }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityConfig = PRIORITY_CONFIG[card.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="cursor-pointer rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-1">
        <button
          className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Link
          to="/workspaces/$workspaceId/boards/$boardId/$cardId"
          params={{ workspaceId, boardId, cardId: card.id }}
          className="min-w-0 flex-1"
        >
          <p className="text-sm font-medium leading-tight">{card.title}</p>
          {card.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {card.description}
            </p>
          )}
          {card.priority !== "none" && (
            <Badge
              variant={priorityConfig.variant}
              className="mt-2 text-xs"
            >
              {priorityConfig.label}
            </Badge>
          )}
        </Link>
      </div>
    </div>
  );
}
