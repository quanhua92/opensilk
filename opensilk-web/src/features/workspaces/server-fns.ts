import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { proxy, extractAccessToken } from "@/lib/api-proxy";
import type { Workspace, CreateWorkspaceRequest } from "./types";

function getCookie(): string | undefined {
  const headers = getRequestHeaders();
  const cookieHeader = headers.get("cookie") || headers.get("Cookie");
  return cookieHeader ? extractAccessToken(cookieHeader) : undefined;
}

export const getWorkspaces = createServerFn({ method: "GET" }).handler(
  async () => {
    return proxy.get<Workspace[]>("/workspaces", getCookie());
  },
);

export const createWorkspace = createServerFn({ method: "POST" })
  .inputValidator((data: CreateWorkspaceRequest) => data)
  .handler(async ({ data }) => {
    return proxy.post<Workspace>("/workspaces", data, getCookie());
  });
