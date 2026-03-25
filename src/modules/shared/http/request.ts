import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

export function getCorrelationId(request: NextRequest): string {
  return request.headers.get("x-correlation-id") ?? randomUUID();
}

export async function readJsonBody<T>(request: NextRequest): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("INVALID_CONTENT_TYPE");
  }

  return (await request.json()) as T;
}
