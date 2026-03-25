import type { NextRequest } from "next/server";

import { createImmutableLog } from "@/modules/security";
import { created, handleApiError, readJsonBody, requireAuth } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const internalAllow = process.env.ALLOW_LEGACY_IMMUTABLE_LOG_ENDPOINT === "true";
    if (!internalAllow) {
      throw new AppError(
        "Legacy immutable log endpoint is disabled. Use /api/internal/logs/immutable",
        "FORBIDDEN",
        undefined,
        403,
      );
    }

    const auth = await requireAuth(request);
    const body = await readJsonBody<{
      action?: string;
      entityType?: string;
      entityId?: string;
      result?: string;
      payload?: unknown;
    }>(request);

    const log = await createImmutableLog(auth, body, correlationId);
    return created(log, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
