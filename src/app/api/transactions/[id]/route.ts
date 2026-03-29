import type { NextRequest } from "next/server";

import { changeTransactionStatus, getTransactionById } from "@/modules/transaction";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Params) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { id } = await ctx.params;
    const tx = await getTransactionById(auth, id);
    return ok(tx, {});
  } catch (unknownError) {
    return handleApiError(request, unknownError);
  }
}

export async function PATCH(request: NextRequest, ctx: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

    const { id } = await ctx.params;
    const body = await readJsonBody<{
      action?: "manager_approve" | "accountant_approve" | "reject" | "execute";
      note?: string;
      reason?: string;
    }>(request);

    const idempotencyKey = request.headers.get("idempotency-key");
    const tx = await changeTransactionStatus(auth, id, body, correlationId, idempotencyKey);
    return ok(tx, {});
  } catch (unknownError) {
    return handleApiError(request, unknownError);
  }
}
