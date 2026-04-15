import { useState, useCallback } from "react";
import type { Card, CardComment, CardStatus } from "../types";
import { DEFAULT_COLUMNS } from "./types";

export function useCardBoard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = DEFAULT_COLUMNS;

  const cardsByStatus = columns.reduce<Record<CardStatus, Card[]>>(
    (acc, col) => {
      acc[col] = [];
      return acc;
    },
    {} as Record<CardStatus, Card[]>,
  );

  for (const card of cards) {
    if (cardsByStatus[card.status]) {
      cardsByStatus[card.status].push(card);
    }
  }

  // Sort by position within each column
  for (const col of columns) {
    cardsByStatus[col].sort((a, b) => a.position - b.position);
  }

  const fetchCards = useCallback(
    async (fetchFn: () => Promise<Card[]>) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchFn();
        setCards(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load cards",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const moveCardOptimistic = (cardId: string, newStatus: CardStatus) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId ? { ...c, status: newStatus } : c,
      ),
    );
  };

  return {
    cards,
    setCards,
    cardsByStatus,
    columns,
    isLoading,
    error,
    fetchCards,
    moveCardOptimistic,
  };
}

export function useComments() {
  const [comments, setComments] = useState<CardComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = useCallback(
    async (fetchFn: () => Promise<CardComment[]>) => {
      setIsLoading(true);
      try {
        const data = await fetchFn();
        setComments(data);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const appendComment = (comment: CardComment) => {
    setComments((prev) => [...prev, comment]);
  };

  return { comments, setComments, isLoading, fetchComments, appendComment };
}
