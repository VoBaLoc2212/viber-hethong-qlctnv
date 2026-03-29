import type { NextRequest } from "next/server";

import { getReimbursementById } from "@/modules/reimbursement";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { id } = await params;
    const reimbursement = await getReimbursementById(auth, id);
    return ok(reimbursement as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
