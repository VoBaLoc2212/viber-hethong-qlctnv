import type { NextRequest } from "next/server";

import { rejectReimbursement } from "@/modules/reimbursement";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT"]);

    const { id } = await params;
    const body = await readJsonBody<{ reason?: string }>(request);
    const reimbursement = await rejectReimbursement(auth, id, body.reason, correlationId);
    return ok(reimbursement as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
