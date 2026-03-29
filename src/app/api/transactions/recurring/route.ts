import type { NextRequest } from "next/server";

import { createRecurringTemplate, listRecurringTemplates } from "@/modules/transaction";
import { created, handleApiError, ok, readJsonBody, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const result = await listRecurringTemplates(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      active: searchParams.has("active") ? searchParams.get("active") === "true" : undefined,
    });

    return ok({ templates: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const body = await readJsonBody<{
      name?: string;
      type?: "INCOME" | "EXPENSE";
      amount?: string;
      frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";
      nextRunAt?: string;
      budgetId?: string | null;
      departmentId?: string | null;
      active?: boolean;
    }>(request);

    const createdTemplate = await createRecurringTemplate(auth, body);
    return created(createdTemplate, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
