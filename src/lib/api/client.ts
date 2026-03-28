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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? (isFormData ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
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
