import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { changeTransactionStatus } from "@/modules/transaction";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["MANAGER", "ACCOUNTANT"]);

    const { id } = await params;

    const approval = await prisma.approval.findUnique({
      where: { id },
      select: { transactionId: true },
    });
    if (!approval) {
      throw new AppError("Approval not found", "NOT_FOUND");
    }

    const body = await readJsonBody<{
      action?: "approve" | "reject" | "execute";
      note?: string;
      reason?: string;
    }>(request);

    const mappedAction = (() => {
      if (body.action === "approve") {
        if (auth.role === "MANAGER") return "manager_approve";
        if (auth.role === "ACCOUNTANT") return "accountant_approve";
        throw new AppError("Only MANAGER or ACCOUNTANT can use approve action", "FORBIDDEN");
      }
      return body.action;
    })();

    if (!mappedAction || !["manager_approve", "accountant_approve", "reject", "execute"].includes(mappedAction)) {
      throw new AppError("action is invalid", "INVALID_INPUT");
    }

    const idempotencyKey = request.headers.get("idempotency-key");

    const transaction = await changeTransactionStatus(
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

    return ok(transaction, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
