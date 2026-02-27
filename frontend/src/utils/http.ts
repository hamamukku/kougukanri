import { getAuthToken } from "./auth";

export class HttpError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function getHttpErrorMessage(error: unknown): string {
  if (!isHttpError(error) || typeof error.message !== "string" || error.message.trim().length === 0) {
    return "通信に失敗しました";
  }
  return error.message;
}

function parseBody(response: Response): Promise<unknown> {
  return response
    .text()
    .then((text) => {
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    })
    .catch(() => null);
}

function getErrorMessage(body: unknown, status: number): string {
  if (!body || typeof body !== "object") {
    return `Request failed (${status})`;
  }

  const envelope = body as { error?: { message?: unknown }; message?: unknown };
  if (envelope.error && typeof envelope.error.message === "string" && envelope.error.message.trim().length > 0) {
    return envelope.error.message;
  }

  if (typeof envelope.message === "string" && envelope.message.trim().length > 0) {
    return envelope.message;
  }

  return `Request failed (${status})`;
}

function buildHeaders(headers: HeadersInit | undefined): Headers {
  const next = new Headers(headers);
  const token = getAuthToken();
  if (token && !next.has("Authorization")) {
    next.set("Authorization", `Bearer ${token}`);
  }
  return next;
}

export async function apiFetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers),
    });
  } catch (error) {
    throw new HttpError(0, "通信に失敗しました", error);
  }

  const body = await parseBody(response);

  if (!response.ok) {
    throw new HttpError(response.status, getErrorMessage(body, response.status), body);
  }

  return body as T;
}
