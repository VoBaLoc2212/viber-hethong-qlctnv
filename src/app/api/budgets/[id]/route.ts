import type { NextRequest } from "next/server";

import { getBudgetById, updateBudgetById } from "@/modules/budgeting";
import { handleApiError, ok, readJsonBody, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const budget = await getBudgetById(auth, id);
    return ok(budget, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const body = await readJsonBody<{
      amount?: string;
      parentBudgetId?: string | null;
    }>(request);

    const budget = await updateBudgetById(auth, id, body, correlationId);
    return ok(budget, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
