import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { approvalAction } from "@/modules/approval";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { getCorrelationId } from "@/modules/shared/http/request";
import { changeTransactionStatus } from "@/modules/transaction";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/approvals/[id] — Manager: approve/reject, Accountant: execute/not-execute
export async function PATCH(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT"]);

    const { id } = await params;
    const body = await readJsonBody<{
      action: "approve" | "reject" | "execute" | "not-execute";
      note?: string;
      reason?: string;
    }>(request);

    if (!body.action) {
      return new Response(JSON.stringify({ error: "action is required" }), { status: 400 });
    }

    if (body.action === "approve") {
      const result = await approvalAction(auth, id, "approve", body.note);
      return ok(result as Record<string, unknown>, {});
    }

    const approval = await prisma.approval.findUnique({
      where: { id },
      select: { transactionId: true },
    });

    if (!approval) {
      throw new AppError("Approval not found", "NOT_FOUND");
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    const mappedAction = body.action === "not-execute" ? "reject" : body.action;

    await changeTransactionStatus(
      auth,
      approval.transactionId,
      {
        action: mappedAction,
        note: body.note,
        reason: body.reason,
        approvalId: id,
      },
      correlationId,
      idempotencyKey,
    );

    const refreshed = await prisma.approval.findUnique({
      where: { id },
      include: {
        transaction: {
          select: { id: true, code: true, status: true, amount: true },
        },
        approver: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return ok((refreshed ?? {}) as Record<string, unknown>, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
