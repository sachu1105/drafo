/**
 * The API client.
 *
 * In the browser everything is same-origin: /api/... is rewritten to Django by
 * next.config.ts, so the session cookie travels on its own and file paths the
 * API hands back can be used verbatim.
 *
 * On the server (the client portal renders server-side, because it has to be
 * fast on a phone) we call Django directly over the internal network.
 */

import { cache } from "react";

export const INTERNAL_API =
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Pull the first human-readable message out of a DRF error body. */
function readError(status: number, body: unknown): string {
  if (typeof body === "string" && body) return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return status === 404 ? "Not found." : "Something went wrong.";
}

// ---------------------------------------------------------------------------
// server side
// ---------------------------------------------------------------------------

/**
 * Fetch as the client, using only their access token.
 *
 * Returns null on 404, which is also what a wrong token gets -- the caller
 * renders the same "link not found" page either way, so a bad token never
 * reveals whether a project exists.
 */
export const fetchClientData = cache(async function fetchClientData<T>(
  path: string,
): Promise<T | null> {
  const response = await fetch(`${INTERNAL_API}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ApiError(response.status, `Upstream ${response.status}`);
  }
  return (await response.json()) as T;
});

// ---------------------------------------------------------------------------
// browser side
// ---------------------------------------------------------------------------

function cookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

let csrfToken: string | null = null;

async function ensureCsrf(): Promise<string> {
  const existing = cookie("csrftoken");
  if (existing) return existing;
  if (csrfToken) return csrfToken;
  const response = await fetch("/api/auth/csrf/", { credentials: "same-origin" });
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

type RequestBody = Record<string, unknown> | FormData | undefined;

export async function api<T>(
  path: string,
  options: { method?: string; body?: RequestBody } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (method !== "GET" && method !== "HEAD") {
    headers["X-CSRFToken"] = await ensureCsrf();
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body,
    credentials: "same-origin",
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* a proxy error page, not JSON -- readError copes */
  }

  if (!response.ok) {
    throw new ApiError(response.status, readError(response.status, parsed), parsed);
  }
  return parsed as T;
}
