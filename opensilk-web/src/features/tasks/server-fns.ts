import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { proxy, extractAccessToken } from "@/lib/api-proxy";
import type { Task, CreateTaskRequest } from "./types";

function getCookie(): string | undefined {
  const headers = getRequestHeaders();
  const cookieHeader = headers.get("cookie") || headers.get("Cookie");
  return cookieHeader ? extractAccessToken(cookieHeader) : undefined;
}

export const getTasks = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; status?: string }) => data,
  )
  .handler(async ({ data }) => {
    const params = data.status ? `?status=${data.status}` : "";
    return proxy.get<Task[]>(
      `/workspaces/${data.workspaceId}/tasks${params}`,
      getCookie(),
    );
  });

export const getTask = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; taskId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<Task>(
      `/workspaces/${data.workspaceId}/tasks/${data.taskId}`,
      getCookie(),
    );
  });

export const createTask = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string } & CreateTaskRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, ...taskData } = data;
    return proxy.post<Task>(
      `/workspaces/${workspaceId}/tasks`,
      taskData,
      getCookie(),
    );
  });

export const cancelTask = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string; taskId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.post<Task>(
      `/workspaces/${data.workspaceId}/tasks/${data.taskId}/cancel`,
      undefined,
      getCookie(),
    );
  });
