import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { proxy, extractAccessToken } from "@/lib/api-proxy";
import type {
  Board,
  Card,
  CardAgent,
  CardComment,
  CardAttachment,
  CreateBoardRequest,
  CreateCardRequest,
  CreateCommentRequest,
  CreateAttachmentRequest,
  CardStatus,
} from "./types";

function getCookie(): string | undefined {
  const headers = getRequestHeaders();
  const cookieHeader = headers.get("cookie") || headers.get("Cookie");
  return cookieHeader ? extractAccessToken(cookieHeader) : undefined;
}

// --- Boards ---

export const getBoards = createServerFn({ method: "GET" })
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data }) => {
    return proxy.get<Board[]>(
      `/workspaces/${data.workspaceId}/boards`,
      getCookie(),
    );
  });

export const getBoard = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<Board>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}`,
      getCookie(),
    );
  });

export const createBoard = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string } & CreateBoardRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, ...boardData } = data;
    return proxy.post<Board>(
      `/workspaces/${workspaceId}/boards`,
      boardData,
      getCookie(),
    );
  });

// --- Cards ---

export const getCards = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; status?: CardStatus }) => data,
  )
  .handler(async ({ data }) => {
    const params = data.status ? `?status=${data.status}` : "";
    return proxy.get<Card[]>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards${params}`,
      getCookie(),
    );
  });

export const getCard = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; cardId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<Card>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}`,
      getCookie(),
    );
  });

export const createCard = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string } & CreateCardRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, boardId, ...cardData } = data;
    return proxy.post<Card>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards`,
      cardData,
      getCookie(),
    );
  });

export const updateCard = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      workspaceId: string;
      boardId: string;
      cardId: string;
      title?: string;
      description?: string;
      status?: CardStatus;
      assigned_agent_id?: string | null;
      priority?: string;
      context_summary?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, boardId, cardId, ...cardData } = data;
    return proxy.patch<Card>(
      `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`,
      cardData,
      getCookie(),
    );
  });

// --- Card Agents ---

export const getCardAgents = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; cardId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<CardAgent[]>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/agents`,
      getCookie(),
    );
  });

export const addCardAgent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      workspaceId: string;
      boardId: string;
      cardId: string;
      agent_id: string;
      role?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, boardId, cardId, ...agentData } = data;
    return proxy.post<CardAgent>(
      `/workspaces/${data.workspaceId}/boards/${boardId}/cards/${cardId}/agents`,
      agentData,
      getCookie(),
    );
  });

export const removeCardAgent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      workspaceId: string;
      boardId: string;
      cardId: string;
      agentId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.delete<void>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/agents/${data.agentId}`,
      getCookie(),
    );
  });

// --- Comments ---

export const getComments = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; cardId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<CardComment[]>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/comments`,
      getCookie(),
    );
  });

export const createComment = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; cardId: string } & CreateCommentRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, boardId, cardId, ...commentData } = data;
    return proxy.post<CardComment>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/comments`,
      commentData,
      getCookie(),
    );
  });

// --- Attachments ---

export const getAttachments = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; cardId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<CardAttachment[]>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/attachments`,
      getCookie(),
    );
  });

export const createAttachment = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string; boardId: string; cardId: string } & CreateAttachmentRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, boardId, cardId, ...attachData } = data;
    return proxy.post<CardAttachment>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/attachments`,
      attachData,
      getCookie(),
    );
  });

export const deleteAttachment = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      workspaceId: string;
      boardId: string;
      cardId: string;
      attachmentId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.delete<void>(
      `/workspaces/${data.workspaceId}/boards/${data.boardId}/cards/${data.cardId}/attachments/${data.attachmentId}`,
      getCookie(),
    );
  });
