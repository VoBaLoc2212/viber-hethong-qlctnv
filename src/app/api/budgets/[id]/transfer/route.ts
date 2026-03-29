import type { NextRequest } from "next/server";

import { transferBudget } from "@/modules/budgeting";
import { created, handleApiError, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await readJsonBody<{
      toBudgetId?: string;
      amount?: string;
      reason?: string;
    }>(request);

    const idempotencyKey = request.headers.get("idempotency-key");

    const transfer = await transferBudget(auth, id, body, idempotencyKey, correlationId);
    return created(transfer, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
