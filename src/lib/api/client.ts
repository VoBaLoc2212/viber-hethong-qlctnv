export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  correlationId?: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function buildRequestBody(body: unknown) {
  if (body === undefined || body === null) return undefined;
  if (body instanceof FormData) return body;
  return JSON.stringify(body);
}

function buildRequestHeaders(options: RequestOptions) {
  const base: Record<string, string> = {
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers ?? {}),
  };

  if (options.body instanceof FormData) {
    return base;
  }

  return {
    "Content-Type": "application/json",
    ...base,
  };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: buildRequestHeaders(options),
    body: buildRequestBody(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as ApiErrorShape | null;
    throw {
      code: errorPayload?.code ?? `HTTP_${response.status}`,
      message: errorPayload?.message ?? "Request failed",
      details: errorPayload?.details,
      correlationId: errorPayload?.correlationId,
    } as ApiErrorShape;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}
