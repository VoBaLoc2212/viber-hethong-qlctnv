import type { NextRequest } from "next/server";

import { completeReimbursement } from "@/modules/reimbursement";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

    const { id } = await params;
    const reimbursement = await completeReimbursement(auth, id, correlationId);
    return ok(reimbursement as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
