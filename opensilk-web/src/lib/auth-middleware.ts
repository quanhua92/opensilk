import { createMiddleware } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { proxy, extractAccessToken } from "@/lib/api-proxy";
import type { User } from "@/features/auth/types";

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const cookieHeader = headers.get("cookie") || headers.get("Cookie");
  const cookie = cookieHeader ? extractAccessToken(cookieHeader) : undefined;

  let user: User | null = null;
  try {
    user = await proxy.get<User>("/auth/me", cookie);
  } catch {
    // Not authenticated
  }

  if (!user) {
    throw redirect({ to: "/" });
  }

  return await next({
    context: { user },
  });
});
