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

export async function apiFetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new HttpError(0, "通信に失敗しました", error);
  }

  const body = await parseBody(response);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && body !== null && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Request failed (${response.status})`;
    throw new HttpError(response.status, message, body);
  }

  return body as T;
}
