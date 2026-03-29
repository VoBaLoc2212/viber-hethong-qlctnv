import type { NextRequest } from "next/server";

import { deleteRecurringTemplate, updateRecurringTemplate } from "@/modules/transaction";
import { handleApiError, noContent, ok, readJsonBody, requireAuth } from "@/modules/shared";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Params) {
  try {
    const auth = await requireAuth(request);
    const { id } = await ctx.params;

    const body = await readJsonBody<{
      name?: string;
      amount?: string;
      frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
      nextRunAt?: string;
      budgetId?: string | null;
      departmentId?: string | null;
      active?: boolean;
    }>(request);

    const updated = await updateRecurringTemplate(auth, id, body);
    return ok(updated, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function DELETE(request: NextRequest, ctx: Params) {
  try {
    const auth = await requireAuth(request);
    const { id } = await ctx.params;

    await deleteRecurringTemplate(auth, id);
    return noContent();
  } catch (error) {
    return handleApiError(request, error);
  }
}
