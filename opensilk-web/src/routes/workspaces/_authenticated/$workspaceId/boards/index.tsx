import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getBoards, createBoard as createBoardFn } from "@/features/boards/server-fns";
import BoardList from "@/features/boards/components/board-list";
import type { Board } from "@/features/boards/types";

export const Route = createFileRoute(
  "/workspaces/_authenticated/$workspaceId/boards/",
)({
  component: BoardsPage,
  loader: async ({ params }) => {
    return {
      initialBoards: await getBoards({ data: { workspaceId: params.workspaceId } }),
    };
  },
});

function BoardsPage() {
  const { workspaceId } = Route.useParams();
  const { initialBoards } = Route.useLoaderData();
  const [boards, setBoards] = useState<Board[]>(initialBoards);

  const handleCreate = async (data: { name: string; description?: string }) => {
    const board = await createBoardFn({ data: { workspaceId, ...data } });
    setBoards((prev) => [...prev, board]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Boards</h1>
      <BoardList
        boards={boards}
        workspaceId={workspaceId}
        onCreate={handleCreate}
      />
    </div>
  );
}
