import type { NextRequest } from "next/server";

import { reverseLedgerEntry } from "@/modules/ledger";
import { created, handleApiError, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN", "ACCOUNTANT"]);
    const { id } = await params;
    const body = await readJsonBody<{ reason?: string }>(request);
    const idempotencyKey = request.headers.get("idempotency-key");

    const reversal = await reverseLedgerEntry(
      auth,
      id,
      body.reason ?? "",
      idempotencyKey,
      correlationId,
    );

    return created(reversal, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
