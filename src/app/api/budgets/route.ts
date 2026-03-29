import type { NextRequest } from "next/server";

import { createBudget, listBudgets } from "@/modules/budgeting";
import { created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);
    const { searchParams } = new URL(request.url);

    const result = await listBudgets(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      departmentId: searchParams.get("departmentId") ?? undefined,
      period: searchParams.get("period") ?? undefined,
    });

    return ok({ budgets: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    const body = await readJsonBody<{
      departmentId?: string;
      period?: string;
      amount?: string;
      parentBudgetId?: string | null;
    }>(request);

    const budget = await createBudget(auth, body, correlationId);
    return created(budget, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
