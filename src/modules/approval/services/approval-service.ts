import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

type ApprovalListFilter = {
  page: number;
  limit: number;
  status?: "PENDING" | "APPROVED" | "REJECTED";
};

export async function listApprovals(auth: AuthContext, filter: ApprovalListFilter) {
  requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where = {
    status: filter.status,
    ...(auth.role === "MANAGER"
      ? { step: 1 }
      : auth.role === "ACCOUNTANT"
        ? { step: 2 }
        : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.approval.count({ where }),
    prisma.approval.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        approver: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
          },
        },
        transaction: {
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            amount: true,
            budgetId: true,
            createdById: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      transactionCode: row.transaction.code,
      transactionType: row.transaction.type,
      transactionStatus: row.transaction.status,
      transactionAmount: row.transaction.amount.toFixed(2),
      budgetId: row.transaction.budgetId,
      requesterId: row.transaction.createdById,
      step: row.step,
      status: row.status,
      note: row.note,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      approver: row.approver,
    })),
    meta: { total, page, limit },
  };
}

export async function bootstrapApprovalRequests(auth: AuthContext, correlationId: string) {
  requireRole(auth, ["FINANCE_ADMIN"]);

  const pending = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      status: "PENDING",
      approvals: { none: { step: 1 } },
    },
    select: { id: true },
  });

  if (pending.length === 0) {
    return { created: 0 };
  }

  const manager = await prisma.user.findFirst({
    where: { role: "MANAGER", isActive: true },
    select: { id: true },
  });

  if (!manager) {
    throw new AppError("No active MANAGER found for approval step 1", "CONFLICT");
  }

  await prisma.$transaction(async (tx) => {
    for (const row of pending) {
      await tx.approval.create({
        data: {
          transactionId: row.id,
          approverId: manager.id,
          step: 1,
          status: "PENDING",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          action: "APPROVAL_REQUEST_CREATE",
          entityType: "TRANSACTION",
          entityId: row.id,
          correlationId,
          payload: {
            step: 1,
            approverId: manager.id,
          },
        },
      });
    }
  });

  return { created: pending.length };
}
