import type { ReimbursementStatus } from "@prisma/client";
import type { NextRequest } from "next/server";

import { createReimbursementRequest, listReimbursements } from "@/modules/reimbursement";
import { created, handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

    const { searchParams } = new URL(request.url);
    const result = await listReimbursements(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      status: (searchParams.get("status") as ReimbursementStatus | null) ?? undefined,
      mine: searchParams.get("mine") === "true",
    });

    return ok({ reimbursements: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["EMPLOYEE"]);

    const body = await readJsonBody<{
      purpose?: string;
      advanceAmount?: string | number;
    }>(request);

    const reimbursement = await createReimbursementRequest(
      auth,
      {
        purpose: body.purpose,
        advanceAmount: typeof body.advanceAmount === "number" ? body.advanceAmount.toFixed(2) : body.advanceAmount,
      },
      correlationId,
    );

    return created(reimbursement, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
