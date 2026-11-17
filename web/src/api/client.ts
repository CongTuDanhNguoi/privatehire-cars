// Small fetch wrapper for the /api proxy. Every failure becomes an ApiError with a user-safe message.

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export class ApiError extends Error {
  constructor(
    readonly status: number, // 0 = network failure
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

// Called when the session has expired (401 on a protected call). Registered by AuthContext.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
  // Login / "who am I" calls handle 401 themselves instead of triggering "session expired".
  skipAuthRedirect?: boolean;
}

export async function api<T>(path: string, { method = "GET", body, signal, skipAuthRedirect }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "same-origin",
      cache: "no-store", // answers depend on the session cookie
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK", NETWORK_ERROR_MESSAGE);
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return data as T;
  // Our API always answers errors with a JSON body. A 5xx without one comes from the dev proxy or a gateway
  // that could not reach the API — treat it like a lost connection.
  if (res.status >= 500 && !data?.error) throw new ApiError(0, "NETWORK", NETWORK_ERROR_MESSAGE);

  const error = (data?.error ?? {}) as { code?: string; message?: string; fields?: Record<string, string> };
  if (res.status === 401 && !skipAuthRedirect) onUnauthorized?.();
  // 5xx (except the email-send 502, which carries a useful message) never shows technical details.
  const message =
    res.status >= 500 && error.code !== "EMAIL_SEND_FAILED"
      ? GENERIC_ERROR_MESSAGE
      : (error.message ?? GENERIC_ERROR_MESSAGE);
  throw new ApiError(res.status, error.code ?? "UNKNOWN", message, error.fields ?? {}, data ?? {});
}
