import type { NextRequest } from "next/server";

import { listApprovals } from "@/modules/approval";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);
    const result = await listApprovals(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      status: (searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null) ?? undefined,
    });

    return ok({ approvals: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}
