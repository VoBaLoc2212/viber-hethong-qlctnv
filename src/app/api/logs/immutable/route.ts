import type { NextRequest } from "next/server";

import { createImmutableLog } from "@/modules/security";
import { created, handleApiError, readJsonBody, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
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
