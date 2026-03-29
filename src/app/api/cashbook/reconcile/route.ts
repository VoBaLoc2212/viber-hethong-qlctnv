import type { NextRequest } from "next/server";

import { reconcileCashbook } from "@/modules/cashbook";
import { created, handleApiError, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

    const body = await readJsonBody<{
      accountId?: string;
      actualBalance?: string;
      reason?: string;
    }>(request);

    const idempotencyKey = request.headers.get("idempotency-key");

    const result = await reconcileCashbook(auth, body, idempotencyKey, correlationId);
    return created(result as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
