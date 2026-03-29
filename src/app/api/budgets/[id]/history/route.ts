import type { NextRequest } from "next/server";

import { getBudgetHistory } from "@/modules/budgeting";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);
    const { id } = await params;
    const history = await getBudgetHistory(auth, id);
    return ok({ history }, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
