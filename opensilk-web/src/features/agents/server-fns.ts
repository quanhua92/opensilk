import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { proxy, extractAccessToken } from "@/lib/api-proxy";
import type { Agent, CreateAgentRequest, UpdateAgentRequest } from "./types";

function getCookie(): string | undefined {
  const headers = getRequestHeaders();
  const cookieHeader = headers.get("cookie") || headers.get("Cookie");
  return cookieHeader ? extractAccessToken(cookieHeader) : undefined;
}

export const getAgents = createServerFn({ method: "GET" })
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data }) => {
    return proxy.get<Agent[]>(
      `/workspaces/${data.workspaceId}/agents`,
      getCookie(),
    );
  });

export const getAgent = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { workspaceId: string; agentId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.get<Agent>(
      `/workspaces/${data.workspaceId}/agents/${data.agentId}`,
      getCookie(),
    );
  });

export const createAgent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string } & CreateAgentRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, ...agentData } = data;
    return proxy.post<Agent>(
      `/workspaces/${workspaceId}/agents`,
      agentData,
      getCookie(),
    );
  });

export const updateAgent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string; agentId: string } & UpdateAgentRequest) => data,
  )
  .handler(async ({ data }) => {
    const { workspaceId, agentId, ...agentData } = data;
    return proxy.patch<Agent>(
      `/workspaces/${workspaceId}/agents/${agentId}`,
      agentData,
      getCookie(),
    );
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { workspaceId: string; agentId: string }) => data,
  )
  .handler(async ({ data }) => {
    return proxy.delete<void>(
      `/workspaces/${data.workspaceId}/agents/${data.agentId}`,
      getCookie(),
    );
  });
