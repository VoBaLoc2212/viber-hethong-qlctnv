import type { NextRequest } from "next/server";

import { payAdvance } from "@/modules/reimbursement";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT"]);

    const { id } = await params;
    const body = await readJsonBody<{ note?: string }>(request);
    const reimbursement = await payAdvance(auth, id, body.note, correlationId);
    return ok(reimbursement as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
