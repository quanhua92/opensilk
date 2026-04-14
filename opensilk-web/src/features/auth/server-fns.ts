import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setCookie, deleteCookie } from "@tanstack/start-server-core";
import { proxy, extractAccessToken } from "@/lib/api-proxy";
import type { User } from "./types";

/**
 * Get the access_token cookie string from the current request headers.
 */
function getAccessTokenCookie(): string | undefined {
  const headers = getRequestHeaders();
  const cookieHeader = headers.get("cookie") || headers.get("Cookie");
  if (!cookieHeader) return undefined;
  return extractAccessToken(cookieHeader);
}

/**
 * Forward Set-Cookie from an upstream response to the client.
 * Parses the Set-Cookie header from the Rust backend and sets it via H3.
 */
function forwardSetCookie(response: Response): void {
  const setCookieHeader = response.headers.get("Set-Cookie");
  if (!setCookieHeader) return;

  // Parse: access_token=<value>; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400
  const [nameValue, ...attrs] = setCookieHeader.split(";");
  const eqIdx = nameValue.indexOf("=");
  if (eqIdx === -1) return;

  const name = nameValue.slice(0, eqIdx).trim();
  const value = nameValue.slice(eqIdx + 1).trim();

  const opts: Record<string, unknown> = {};
  for (const attr of attrs) {
    const trimmed = attr.trim();
    const attrEq = trimmed.indexOf("=");
    if (attrEq === -1) {
      // Boolean flags like HttpOnly, Secure
      opts[trimmed] = true;
    } else {
      const key = trimmed.slice(0, attrEq).trim();
      const val = trimmed.slice(attrEq + 1).trim();
      if (key === "Max-Age") opts.maxAge = Number(val);
      else if (key === "Path") opts.path = val;
      else if (key === "SameSite") opts.sameSite = val;
      else if (key === "Domain") opts.domain = val;
      opts[key] = val;
    }
  }

  setCookie(name, value, opts as Parameters<typeof setCookie>[2]);
}

/**
 * Login: calls opensilk-server's /auth/login and returns the user.
 * Forwards the Set-Cookie from opensilk-server to the client.
 */
export const login = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const response = await fetch(`${process.env.API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `Login failed (${response.status})`);
    }

    const user: User = await response.json();
    forwardSetCookie(response);
    return user;
  });

/**
 * Register: calls opensilk-server's /auth/register, then auto-login.
 */
export const register = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { email: string; password: string; full_name?: string }) => data,
  )
  .handler(async ({ data }) => {
    const response = await fetch(`${process.env.API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.message || `Registration failed (${response.status})`,
      );
    }

    // Auto-login after registration
    const loginResponse = await fetch(`${process.env.API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });

    if (!loginResponse.ok) {
      throw new Error("Auto-login after registration failed");
    }

    const user: User = await loginResponse.json();
    forwardSetCookie(loginResponse);
    return user;
  });

/**
 * Logout: clears the cookie and calls opensilk-server's /auth/logout.
 */
export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const cookie = getAccessTokenCookie();
  await proxy.post("/auth/logout", undefined, cookie);
  deleteCookie("access_token");
  return { success: true };
});

/**
 * Get current session: calls /auth/me with forwarded cookie.
 * Returns null if not authenticated.
 */
export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const cookie = getAccessTokenCookie();
      return await proxy.get<User>("/auth/me", cookie);
    } catch {
      return null;
    }
  },
);
