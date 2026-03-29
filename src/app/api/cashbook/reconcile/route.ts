import type { NextRequest } from "next/server";

import { reconcileCashbook } from "@/modules/cashbook";
import { created, handleApiError, readJsonBody, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const idempotencyKey = request.headers.get("idempotency-key");

    const body = await readJsonBody<{
      accountId?: string;
      actualBalance?: string;
      reason?: string;
    }>(request);

    const result = await reconcileCashbook(
      auth,
      {
        accountId: body.accountId,
        actualBalance: body.actualBalance,
        reason: body.reason,
      },
      correlationId,
      idempotencyKey,
    );

    return created(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
