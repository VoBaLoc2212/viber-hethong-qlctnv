import { type ReimbursementStatus, type SettlementDirection } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { requireRole, type AuthContext, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { centsToMoney, compareMoney, moneyToCents } from "@/modules/shared/finance/decimal";

type ReimbursementFilter = {
  page: number;
  limit: number;
  status?: ReimbursementStatus;
  mine?: boolean;
};

type CreateReimbursementPayload = {
  purpose?: string;
  advanceAmount?: string;
};

type SubmitSettlementPayload = {
  actualAmount?: string;
  settlementNote?: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize?: number | null;
    mimeType?: string | null;
  }>;
};

function toReimbursementView(row: {
  id: string;
  employeeId: string;
  approvedById: string | null;
  paidById: string | null;
  reviewedById: string | null;
  purpose: string;
  advanceAmount: { toFixed: (scale: number) => string };
  actualAmount: { toFixed: (scale: number) => string } | null;
  netAmount: { toFixed: (scale: number) => string } | null;
  settlementDirection: SettlementDirection | null;
  settlementNote: string | null;
  attachmentsJson: unknown;
  status: ReimbursementStatus;
  advanceRequestedAt: Date;
  advanceApprovedAt: Date | null;
  advancePaidAt: Date | null;
  settlementSubmittedAt: Date | null;
  settlementReviewedAt: Date | null;
  completedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: { id: string; fullName: string; email: string };
  approvedBy?: { id: string; fullName: string } | null;
  paidBy?: { id: string; fullName: string } | null;
  reviewedBy?: { id: string; fullName: string } | null;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    approvedById: row.approvedById,
    paidById: row.paidById,
    reviewedById: row.reviewedById,
    purpose: row.purpose,
    advanceAmount: row.advanceAmount.toFixed(2),
    actualAmount: row.actualAmount?.toFixed(2) ?? null,
    netAmount: row.netAmount?.toFixed(2) ?? null,
    settlementDirection: row.settlementDirection,
    settlementNote: row.settlementNote,
    attachments: Array.isArray(row.attachmentsJson) ? row.attachmentsJson : [],
    status: row.status,
    advanceRequestedAt: row.advanceRequestedAt.toISOString(),
    advanceApprovedAt: row.advanceApprovedAt?.toISOString() ?? null,
    advancePaidAt: row.advancePaidAt?.toISOString() ?? null,
    settlementSubmittedAt: row.settlementSubmittedAt?.toISOString() ?? null,
    settlementReviewedAt: row.settlementReviewedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    employee: row.employee ? { id: row.employee.id, fullName: row.employee.fullName, email: row.employee.email } : undefined,
    approvedBy: row.approvedBy ? { id: row.approvedBy.id, fullName: row.approvedBy.fullName } : null,
    paidBy: row.paidBy ? { id: row.paidBy.id, fullName: row.paidBy.fullName } : null,
    reviewedBy: row.reviewedBy ? { id: row.reviewedBy.id, fullName: row.reviewedBy.fullName } : null,
  };
}

function assertStatus(current: ReimbursementStatus, expected: ReimbursementStatus, message: string) {
  if (current !== expected) {
    throw new AppError(message, "UNPROCESSABLE_ENTITY");
  }
}

export function computeSettlement(advanceAmount: string, actualAmount: string): {
  netAmount: string;
  direction: SettlementDirection;
} {
  const net = moneyToCents(advanceAmount) - moneyToCents(actualAmount);
  if (net > 0) return { netAmount: centsToMoney(net), direction: "RETURN_TO_COMPANY" };
  if (net < 0) return { netAmount: centsToMoney(net), direction: "PAY_TO_EMPLOYEE" };
  return { netAmount: "0.00", direction: "NO_CHANGE" };
}

function ensureOwner(auth: AuthContext, employeeId: string) {
  if (auth.role === "EMPLOYEE" && auth.userId !== employeeId) {
    throw new AppError("Forbidden", "FORBIDDEN");
  }
}

export async function listReimbursements(auth: AuthContext, filter: ReimbursementFilter) {
  requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;

  if (auth.role === "EMPLOYEE" || filter.mine) {
    where.employeeId = auth.userId;
  }

  const [total, rows] = await Promise.all([
    prisma.reimbursement.count({ where }),
    prisma.reimbursement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: limit,
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    }),
  ]);

  return {
    data: rows.map((row) => toReimbursementView(row)),
    meta: { total, page, limit },
  };
}

export async function getReimbursementById(auth: AuthContext, id: string) {
  requireRole(auth, ["EMPLOYEE", "MANAGER", "ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const row = await prisma.reimbursement.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, fullName: true, email: true } },
      approvedBy: { select: { id: true, fullName: true } },
      paidBy: { select: { id: true, fullName: true } },
      reviewedBy: { select: { id: true, fullName: true } },
    },
  });

  if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
  ensureOwner(auth, row.employeeId);

  return toReimbursementView(row);
}

export async function createReimbursementRequest(auth: AuthContext, payload: CreateReimbursementPayload, correlationId: string) {
  requireRole(auth, ["EMPLOYEE", "FINANCE_ADMIN"]);

  const purpose = payload.purpose?.trim();
  if (!purpose) throw new AppError("purpose is required", "INVALID_INPUT");

  const advanceAmount = payload.advanceAmount?.trim();
  if (!advanceAmount) throw new AppError("advanceAmount is required", "INVALID_INPUT");
  if (compareMoney(advanceAmount, "0.00") <= 0) {
    throw new AppError("advanceAmount must be greater than 0", "INVALID_INPUT");
  }

  const created = await prisma.reimbursement.create({
    data: {
      employeeId: auth.userId,
      purpose,
      advanceAmount,
      status: "PENDING_APPROVAL",
      advanceRequestedAt: new Date(),
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "REIMBURSEMENT_CREATE",
    entityType: "REIMBURSEMENT",
    entityId: created.id,
    correlationId,
    payload: { advanceAmount, purpose, status: created.status },
  });

  return getReimbursementById(auth, created.id);
}

export async function approveAdvance(auth: AuthContext, id: string, note: string | undefined, correlationId: string) {
  requireRole(auth, ["MANAGER", "FINANCE_ADMIN"]);

  return prisma.$transaction(async (db) => {
    const row = await db.reimbursement.findUnique({ where: { id } });
    if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
    assertStatus(row.status, "PENDING_APPROVAL", "Chỉ duyệt được đề nghị đang chờ duyệt");

    const now = new Date();
    const updated = await db.reimbursement.update({
      where: { id },
      data: {
        status: "ADVANCE_APPROVED",
        approvedById: auth.userId,
        settlementNote: note?.trim() || row.settlementNote,
        advanceApprovedAt: now,
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "REIMBURSEMENT_ADVANCE_APPROVE",
      entityType: "REIMBURSEMENT",
      entityId: id,
      correlationId,
      payload: { fromStatus: row.status, toStatus: "ADVANCE_APPROVED", note: note?.trim() ?? null },
    });

    return toReimbursementView(updated);
  });
}

export async function rejectReimbursement(auth: AuthContext, id: string, reason: string | undefined, correlationId: string) {
  requireRole(auth, ["MANAGER", "ACCOUNTANT", "FINANCE_ADMIN"]);

  return prisma.$transaction(async (db) => {
    const row = await db.reimbursement.findUnique({ where: { id } });
    if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
    if (row.status === "COMPLETED" || row.status === "REJECTED") {
      throw new AppError("Không thể từ chối hồ sơ đã kết thúc", "UNPROCESSABLE_ENTITY");
    }

    const updated = await db.reimbursement.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() ?? null,
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "REIMBURSEMENT_REJECT",
      entityType: "REIMBURSEMENT",
      entityId: id,
      correlationId,
      payload: { fromStatus: row.status, toStatus: "REJECTED", reason: reason?.trim() ?? null },
    });

    return toReimbursementView(updated);
  });
}

export async function payAdvance(auth: AuthContext, id: string, note: string | undefined, correlationId: string) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  return prisma.$transaction(async (db) => {
    const row = await db.reimbursement.findUnique({ where: { id } });
    if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
    assertStatus(row.status, "ADVANCE_APPROVED", "Chỉ chi tạm ứng được hồ sơ đã duyệt");

    const updated = await db.reimbursement.update({
      where: { id },
      data: {
        status: "ADVANCE_PAID",
        paidById: auth.userId,
        settlementNote: note?.trim() || row.settlementNote,
        advancePaidAt: new Date(),
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "REIMBURSEMENT_ADVANCE_PAID",
      entityType: "REIMBURSEMENT",
      entityId: id,
      correlationId,
      payload: { fromStatus: row.status, toStatus: "ADVANCE_PAID", note: note?.trim() ?? null },
    });

    return toReimbursementView(updated);
  });
}

export async function submitSettlement(auth: AuthContext, id: string, payload: SubmitSettlementPayload, correlationId: string) {
  requireRole(auth, ["EMPLOYEE", "FINANCE_ADMIN"]);

  const actualAmount = payload.actualAmount?.trim();
  if (!actualAmount) throw new AppError("actualAmount is required", "INVALID_INPUT");
  if (compareMoney(actualAmount, "0.00") <= 0) throw new AppError("actualAmount must be greater than 0", "INVALID_INPUT");

  return prisma.$transaction(async (db) => {
    const row = await db.reimbursement.findUnique({ where: { id } });
    if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
    ensureOwner(auth, row.employeeId);
    assertStatus(row.status, "ADVANCE_PAID", "Chỉ nộp quyết toán sau khi đã chi tạm ứng");

    const computed = computeSettlement(row.advanceAmount.toFixed(2), actualAmount);

    const updated = await db.reimbursement.update({
      where: { id },
      data: {
        status: "SETTLEMENT_SUBMITTED",
        actualAmount,
        netAmount: computed.netAmount,
        settlementDirection: computed.direction,
        settlementNote: payload.settlementNote?.trim() || row.settlementNote,
        attachmentsJson: payload.attachments ?? [],
        settlementSubmittedAt: new Date(),
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "REIMBURSEMENT_SETTLEMENT_SUBMIT",
      entityType: "REIMBURSEMENT",
      entityId: id,
      correlationId,
      payload: {
        fromStatus: row.status,
        toStatus: "SETTLEMENT_SUBMITTED",
        actualAmount,
        netAmount: computed.netAmount,
        settlementDirection: computed.direction,
      },
    });

    return toReimbursementView(updated);
  });
}

export async function reviewSettlement(auth: AuthContext, id: string, note: string | undefined, correlationId: string) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  return prisma.$transaction(async (db) => {
    const row = await db.reimbursement.findUnique({ where: { id } });
    if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
    assertStatus(row.status, "SETTLEMENT_SUBMITTED", "Chỉ review hồ sơ đã nộp quyết toán");

    const updated = await db.reimbursement.update({
      where: { id },
      data: {
        status: "SETTLEMENT_REVIEWED",
        reviewedById: auth.userId,
        settlementNote: note?.trim() || row.settlementNote,
        settlementReviewedAt: new Date(),
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "REIMBURSEMENT_SETTLEMENT_REVIEW",
      entityType: "REIMBURSEMENT",
      entityId: id,
      correlationId,
      payload: { fromStatus: row.status, toStatus: "SETTLEMENT_REVIEWED", note: note?.trim() ?? null },
    });

    return toReimbursementView(updated);
  });
}

export async function completeReimbursement(auth: AuthContext, id: string, correlationId: string) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  return prisma.$transaction(async (db) => {
    const row = await db.reimbursement.findUnique({ where: { id } });
    if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");
    assertStatus(row.status, "SETTLEMENT_REVIEWED", "Chỉ hoàn tất hồ sơ đã review quyết toán");

    const updated = await db.reimbursement.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        paidBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "REIMBURSEMENT_COMPLETE",
      entityType: "REIMBURSEMENT",
      entityId: id,
      correlationId,
      payload: {
        fromStatus: row.status,
        toStatus: "COMPLETED",
        netAmount: row.netAmount?.toFixed(2) ?? null,
        settlementDirection: row.settlementDirection ?? null,
      },
    });

    return toReimbursementView(updated);
  });
}
