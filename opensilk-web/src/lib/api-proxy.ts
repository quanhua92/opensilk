import { API_URL } from "@/lib/constants";

export class ProxyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProxyError";
    this.status = status;
  }
}

async function proxyRequest<T>(
  path: string,
  options: RequestInit = {},
  forwardCookie?: string,
): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (forwardCookie) {
    headers["Cookie"] = forwardCookie;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ProxyError(
      response.status,
      body.message || `Proxy error ${response.status}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

/**
 * Extract the access_token cookie from a Cookie header string.
 */
export function extractAccessToken(cookieHeader: string): string | undefined {
  const match = cookieHeader.match(/access_token=([^;]+)/);
  return match ? `access_token=${match[1]}` : undefined;
}

/**
 * Server-side proxy to opensilk-server.
 * Pass the incoming request's Cookie header to forward auth.
 */
export const proxy = {
  get: <T>(path: string, cookie?: string) =>
    proxyRequest<T>(path, { method: "GET" }, cookie),
  post: <T>(path: string, body?: unknown, cookie?: string) =>
    proxyRequest<T>(
      path,
      { method: "POST", body: body ? JSON.stringify(body) : undefined },
      cookie,
    ),
  patch: <T>(path: string, body?: unknown, cookie?: string) =>
    proxyRequest<T>(
      path,
      { method: "PATCH", body: body ? JSON.stringify(body) : undefined },
      cookie,
    ),
  delete: <T>(path: string, cookie?: string) =>
    proxyRequest<T>(path, { method: "DELETE" }, cookie),
};
