import { prisma } from "@/lib/db/prisma/client";
import { assertNotAuditorForMutation, type AuthContext, requireRole } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

type ApprovalListFilter = {
  page: number;
  limit: number;
  status?: ApprovalStatus;
};

/**
 * Sync all EXPENSE transactions that don't have an Approval record yet.
 * Creates Approval rows with status matching the transaction status.
 */
export async function syncExpenseToApprovals() {
  const txns = await prisma.transaction.findMany({
    where: {
      type: "EXPENSE",
      approvals: { none: {} },
    },
    select: { id: true, status: true },
  });

  if (txns.length === 0) return { synced: 0 };

  const statusMap: Record<string, ApprovalStatus> = {
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    EXECUTED: "APPROVED",
    REJECTED: "REJECTED",
    REVERSED: "REJECTED",
    DRAFT: "PENDING",
  };

  await prisma.approval.createMany({
    data: txns.map((t) => ({
      transactionId: t.id,
      status: statusMap[t.status] ?? "PENDING",
    })),
  });

  return { synced: txns.length };
}

export async function listApprovals(auth: AuthContext, filter: ApprovalListFilter) {
  requireRole(auth, ["MANAGER", "ACCOUNTANT"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filter.status) {
    where.status = filter.status;
  }

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
            description: true,
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
      transactionDescription: row.transaction.description,
      requesterId: row.transaction.createdById,
      status: row.status as ApprovalStatus,
      note: row.note,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      approver: row.approver
        ? { id: row.approver.id, fullName: row.approver.fullName, role: row.approver.role }
        : null,
    })),
    meta: { total, page, limit },
  };
}

/**
 * Manager: approve (PENDING→APPROVED) / reject (PENDING→REJECTED)
 * Accountant: execute (APPROVED→tx EXECUTED) / not-execute (APPROVED→REJECTED)
 * Also updates the linked transaction status.
 */
export async function approvalAction(
  auth: AuthContext,
  approvalId: string,
  action: "approve" | "reject" | "execute" | "not-execute",
  note?: string,
) {
  return prisma.$transaction(async (db) => {
    const approval = await db.approval.findUnique({
      where: { id: approvalId },
      include: { transaction: true },
    });
    if (!approval) {
      throw new AppError("Approval not found", "NOT_FOUND");
    }

    switch (action) {
      case "approve": {
        requireRole(auth, ["MANAGER"]);
        if (approval.status !== "PENDING") {
          throw new AppError("Chỉ duyệt được phiếu ở trạng thái PENDING", "UNPROCESSABLE_ENTITY");
        }
        await db.approval.update({
          where: { id: approvalId },
          data: { status: "APPROVED", approverId: auth.userId, note, approvedAt: new Date() },
        });
        await db.transaction.update({
          where: { id: approval.transactionId },
          data: { status: "APPROVED" },
        });
        break;
      }
      case "reject": {
        requireRole(auth, ["MANAGER"]);
        if (approval.status !== "PENDING") {
          throw new AppError("Chỉ từ chối được phiếu ở trạng thái PENDING", "UNPROCESSABLE_ENTITY");
        }
        await db.approval.update({
          where: { id: approvalId },
          data: { status: "REJECTED", approverId: auth.userId, note },
        });
        await db.transaction.update({
          where: { id: approval.transactionId },
          data: { status: "REJECTED" },
        });
        break;
      }
      case "execute": {
        requireRole(auth, ["ACCOUNTANT"]);
        if (approval.status !== "APPROVED") {
          throw new AppError("Chỉ chi được phiếu đã duyệt (APPROVED)", "UNPROCESSABLE_ENTITY");
        }
        // Approval stays APPROVED; transaction moves to EXECUTED
        await db.approval.update({
          where: { id: approvalId },
          data: { note },
        });
        await db.transaction.update({
          where: { id: approval.transactionId },
          data: { status: "EXECUTED" },
        });
        break;
      }
      case "not-execute": {
        requireRole(auth, ["ACCOUNTANT"]);
        if (approval.status !== "APPROVED") {
          throw new AppError("Chỉ từ chối chi phiếu đã duyệt (APPROVED)", "UNPROCESSABLE_ENTITY");
        }
        await db.approval.update({
          where: { id: approvalId },
          data: { status: "REJECTED", note },
        });
        await db.transaction.update({
          where: { id: approval.transactionId },
          data: { status: "REJECTED" },
        });
        break;
      }
      default:
        throw new AppError("Invalid action", "INVALID_INPUT");
    }

    return db.approval.findUnique({
      where: { id: approvalId },
      include: {
        transaction: {
          select: { id: true, code: true, status: true, amount: true },
        },
        approver: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });
  });
}
