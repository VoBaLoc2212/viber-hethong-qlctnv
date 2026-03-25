import type { NextRequest } from "next/server";

import { requireJwtSecret } from "@/lib/auth/jwt";
import { login } from "@/modules/security";
import { handleApiError, readJsonBody } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";
import { ok } from "@/modules/shared/http/response";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await readJsonBody<{ username?: string; password?: string }>(request);
    const result = await login(
      {
        username: body.username ?? "",
        password: body.password ?? "",
      },
      requireJwtSecret(),
      correlationId,
    );

    return ok(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
