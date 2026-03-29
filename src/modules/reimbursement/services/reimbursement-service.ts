import { createHash } from "node:crypto";

import { Prisma, type ReimbursementStatus, type SettlementDirection } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { addMoney, requireRole, type AuthContext, writeAuditLog } from "@/modules/shared";
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

function decimalToString(value: { toFixed: (scale: number) => string }): string {
  return value.toFixed(2);
}

function buildIdempotencyCodeSuffix(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12).toUpperCase();
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function createCashbookPosting(
  db: Prisma.TransactionClient,
  transactionId: string,
  amount: string,
  direction: "IN" | "OUT",
) {
  const account = await db.cashbookAccount.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, balance: true },
  });

  if (!account) {
    throw new AppError("No cashbook account available for reimbursement posting", "CONFLICT");
  }

  const nextBalance = direction === "IN"
    ? addMoney(decimalToString(account.balance), amount)
    : addMoney(decimalToString(account.balance), `-${amount}`);

  await db.cashbookAccount.update({
    where: { id: account.id },
    data: { balance: nextBalance },
  });

  const posting = await db.cashbookPosting.create({
    data: {
      accountId: account.id,
      transactionId,
      direction,
      amount,
    },
  });

  return {
    postingId: posting.id,
    accountId: account.id,
  };
}

async function createReimbursementPosting(
  db: Prisma.TransactionClient,
  auth: AuthContext,
  reimbursementId: string,
  amount: string,
  type: "INCOME" | "EXPENSE",
  direction: "IN" | "OUT",
  description: string,
  correlationId: string,
  idempotencyKey: string,
  actionLabel: string,
) {
  const idempotencyCode = buildIdempotencyCodeSuffix(`${reimbursementId}:${actionLabel}:${idempotencyKey}`);

  const transaction = await db.transaction.create({
    data: {
      code: `TXN-RB-${actionLabel}-${idempotencyCode}`,
      type,
      status: "EXECUTED",
      amount,
      currency: "VND",
      date: new Date(),
      description,
      createdById: auth.userId,
    },
  });

  const ledger = await db.ledgerEntry.create({
    data: {
      entryCode: `LED-RB-${actionLabel}-${idempotencyCode}`,
      type,
      amount,
      currency: "VND",
      referenceType: "REIMBURSEMENT",
      referenceId: reimbursementId,
      createdById: auth.userId,
      metadata: {
        reimbursementId,
        transactionId: transaction.id,
        idempotencyKey,
        action: actionLabel,
      },
    },
  });

  const cashbook = await createCashbookPosting(db, transaction.id, amount, direction);

  await writeAuditLog({
    actorId: auth.userId,
    action: "REIMBURSEMENT_POSTING_CREATE",
    entityType: "REIMBURSEMENT",
    entityId: reimbursementId,
    correlationId,
    payload: {
      reimbursementId,
      transactionId: transaction.id,
      ledgerEntryId: ledger.id,
      cashbookPostingId: cashbook.postingId,
      cashbookAccountId: cashbook.accountId,
      amount,
      type,
      direction,
      idempotencyKey,
      action: actionLabel,
    },
  });

  return {
    transactionId: transaction.id,
    ledgerEntryId: ledger.id,
    cashbookPostingId: cashbook.postingId,
    cashbookAccountId: cashbook.accountId,
  };
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
  requireRole(auth, ["EMPLOYEE"]);

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
  requireRole(auth, ["MANAGER"]);

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
  requireRole(auth, ["MANAGER", "ACCOUNTANT"]);

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

export async function payAdvance(
  auth: AuthContext,
  id: string,
  note: string | undefined,
  correlationId: string,
  idempotencyKey?: string | null,
) {
  requireRole(auth, ["ACCOUNTANT"]);

  if (!idempotencyKey) {
    throw new AppError("idempotency-key header is required", "INVALID_INPUT");
  }

  try {
    return await prisma.$transaction(async (db) => {
      const row = await db.reimbursement.findUnique({ where: { id } });
      if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");

      if (row.status === "ADVANCE_PAID") {
        const existing = await db.reimbursement.findUnique({
          where: { id },
          include: {
            employee: { select: { id: true, fullName: true, email: true } },
            approvedBy: { select: { id: true, fullName: true } },
            paidBy: { select: { id: true, fullName: true } },
            reviewedBy: { select: { id: true, fullName: true } },
          },
        });
        if (!existing) throw new AppError("Reimbursement not found", "NOT_FOUND");
        return toReimbursementView(existing);
      }

      assertStatus(row.status, "ADVANCE_APPROVED", "Chỉ chi tạm ứng được hồ sơ đã duyệt");

      const posting = await createReimbursementPosting(
        db,
        auth,
        id,
        decimalToString(row.advanceAmount),
        "EXPENSE",
        "OUT",
        `Reimbursement advance payment: ${row.purpose}`,
        correlationId,
        idempotencyKey,
        "ADVANCE",
      );

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
        payload: {
          fromStatus: row.status,
          toStatus: "ADVANCE_PAID",
          note: note?.trim() ?? null,
          idempotencyKey,
          posting,
        },
      });

      return toReimbursementView(updated);
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      return getReimbursementById(auth, id);
    }

    throw error;
  }
}

export async function submitSettlement(auth: AuthContext, id: string, payload: SubmitSettlementPayload, correlationId: string) {
  requireRole(auth, ["EMPLOYEE"]);

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
  requireRole(auth, ["ACCOUNTANT"]);

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

export async function completeReimbursement(
  auth: AuthContext,
  id: string,
  correlationId: string,
  idempotencyKey?: string | null,
) {
  requireRole(auth, ["ACCOUNTANT"]);

  if (!idempotencyKey) {
    throw new AppError("idempotency-key header is required", "INVALID_INPUT");
  }

  try {
    return await prisma.$transaction(async (db) => {
      const row = await db.reimbursement.findUnique({ where: { id } });
      if (!row) throw new AppError("Reimbursement not found", "NOT_FOUND");

      if (row.status === "COMPLETED") {
        const existing = await db.reimbursement.findUnique({
          where: { id },
          include: {
            employee: { select: { id: true, fullName: true, email: true } },
            approvedBy: { select: { id: true, fullName: true } },
            paidBy: { select: { id: true, fullName: true } },
            reviewedBy: { select: { id: true, fullName: true } },
          },
        });
        if (!existing) throw new AppError("Reimbursement not found", "NOT_FOUND");
        return toReimbursementView(existing);
      }

      assertStatus(row.status, "SETTLEMENT_REVIEWED", "Chỉ hoàn tất hồ sơ đã review quyết toán");

      const postingAmount = row.netAmount ? centsToMoney(Math.abs(moneyToCents(row.netAmount.toFixed(2)))) : "0.00";
      const settlementDirection = row.settlementDirection ?? "NO_CHANGE";

      let posting: {
        transactionId: string;
        ledgerEntryId: string;
        cashbookPostingId: string;
        cashbookAccountId: string;
      } | null = null;

      if (compareMoney(postingAmount, "0.00") > 0 && settlementDirection !== "NO_CHANGE") {
        posting = await createReimbursementPosting(
          db,
          auth,
          id,
          postingAmount,
          settlementDirection === "RETURN_TO_COMPANY" ? "INCOME" : "EXPENSE",
          settlementDirection === "RETURN_TO_COMPANY" ? "IN" : "OUT",
          `Reimbursement settlement: ${row.purpose}`,
          correlationId,
          idempotencyKey,
          "SETTLEMENT",
        );
      }

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
          settlementDirection,
          idempotencyKey,
          posting,
        },
      });

      return toReimbursementView(updated);
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      return getReimbursementById(auth, id);
    }

    throw error;
  }
}
