import type { NextRequest } from "next/server";

import { listCashbook } from "@/modules/cashbook";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);
    const result = await listCashbook(auth, {
      accountId: searchParams.get("accountId") ?? undefined,
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "30"),
    });

    return ok(result as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
