import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext, addMoney, compareMoney, requireRole, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

type ListCashbookFilter = {
  page: number;
  limit: number;
  accountId?: string;
};

type ReconcilePayload = {
  accountId?: string;
  actualBalance?: string;
  reason?: string;
};

function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildIdempotencyCodeSuffix(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12).toUpperCase();
}

function toPositiveMoney(value: string): string {
  return value.startsWith("-") ? value.slice(1) : value;
}

export async function listCashbook(auth: AuthContext, filter: ListCashbookFilter) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const accountWhere: Prisma.CashbookAccountWhereInput = {
    id: filter.accountId,
  };

  const [accounts, postingTotal, postings] = await Promise.all([
    prisma.cashbookAccount.findMany({
      where: accountWhere,
      orderBy: { createdAt: "asc" },
    }),
    prisma.cashbookPosting.count({
      where: {
        accountId: filter.accountId,
      },
    }),
    prisma.cashbookPosting.findMany({
      where: {
        accountId: filter.accountId,
      },
      orderBy: { postedAt: "desc" },
      skip,
      take: limit,
      include: {
        transaction: {
          select: {
            id: true,
            code: true,
            type: true,
            status: true,
            description: true,
            date: true,
          },
        },
      },
    }),
  ]);

  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: decimalToString(account.balance),
      updatedAt: account.updatedAt.toISOString(),
    })),
    postings: postings.map((posting) => ({
      id: posting.id,
      accountId: posting.accountId,
      transactionId: posting.transactionId,
      direction: posting.direction,
      amount: decimalToString(posting.amount),
      postedAt: posting.postedAt.toISOString(),
      transaction: {
        id: posting.transaction.id,
        code: posting.transaction.code,
        type: posting.transaction.type,
        status: posting.transaction.status,
        description: posting.transaction.description,
        date: posting.transaction.date.toISOString(),
      },
    })),
    meta: {
      total: postingTotal,
      page,
      limit,
    },
  };
}

export async function reconcileCashbook(
  auth: AuthContext,
  payload: ReconcilePayload,
  correlationId: string,
  idempotencyKey: string | null,
) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  if (!idempotencyKey) {
    throw new AppError("idempotency-key header is required", "INVALID_INPUT");
  }

  if (!payload.accountId) {
    throw new AppError("accountId is required", "INVALID_INPUT");
  }

  if (!payload.actualBalance) {
    throw new AppError("actualBalance is required", "INVALID_INPUT");
  }

  if (!payload.reason) {
    throw new AppError("reason is required", "INVALID_INPUT");
  }

  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "CASHBOOK_RECONCILE",
      entityType: "CASHBOOK_ACCOUNT",
      entityId: payload.accountId,
      payload: {
        path: ["idempotencyKey"],
        equals: idempotencyKey,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      replayed: true,
      idempotencyKey,
      message: "Reconcile request already processed",
    };
  }

  const account = await prisma.cashbookAccount.findUnique({
    where: { id: payload.accountId },
  });

  if (!account) {
    throw new AppError("Cashbook account not found", "NOT_FOUND");
  }

  const systemBalance = decimalToString(account.balance);
  const delta = addMoney(payload.actualBalance, `-${systemBalance}`);

  if (compareMoney(delta, "0.00") === 0) {
    await writeAuditLog({
      actorId: auth.userId,
      action: "CASHBOOK_RECONCILE",
      entityType: "CASHBOOK_ACCOUNT",
      entityId: account.id,
      correlationId,
      payload: {
        accountId: account.id,
        reason: payload.reason,
        idempotencyKey,
        systemBalance,
        actualBalance: payload.actualBalance,
        delta,
        adjusted: false,
      },
    });

    return {
      replayed: false,
      adjusted: false,
      idempotencyKey,
      accountId: account.id,
      systemBalance,
      actualBalance: payload.actualBalance,
      delta,
    };
  }

  const adjustmentAmount = toPositiveMoney(delta);
  const direction = compareMoney(delta, "0.00") > 0 ? "IN" : "OUT";
  const txType = direction === "IN" ? "INCOME" : "EXPENSE";
  const idempotencyCode = buildIdempotencyCodeSuffix(`${payload.accountId}:${idempotencyKey}`);

  let result: {
    adjustmentTransaction: { id: string };
    posting: { id: string };
    ledger: { id: string };
  };

  try {
    result = await prisma.$transaction(async (db) => {
      const adjustmentTransaction = await db.transaction.create({
        data: {
          code: `TXN-ADJ-${idempotencyCode}`,
          type: txType,
          status: "EXECUTED",
          amount: adjustmentAmount,
          currency: "VND",
          date: new Date(),
          description: payload.reason,
          createdById: auth.userId,
        },
      });

      await db.cashbookAccount.update({
        where: { id: account.id },
        data: {
          balance: payload.actualBalance,
        },
      });

      const posting = await db.cashbookPosting.create({
        data: {
          accountId: account.id,
          transactionId: adjustmentTransaction.id,
          direction,
          amount: adjustmentAmount,
        },
      });

      const ledger = await db.ledgerEntry.create({
        data: {
          entryCode: `LED-ADJ-${idempotencyCode}`,
          type: "ADJUSTMENT",
          amount: adjustmentAmount,
          currency: "VND",
          referenceType: "TRANSACTION",
          referenceId: adjustmentTransaction.id,
          createdById: auth.userId,
          metadata: {
            source: "CASHBOOK_RECONCILE",
            accountId: account.id,
            direction,
            reason: payload.reason,
            idempotencyKey,
            systemBalance,
            actualBalance: payload.actualBalance,
            delta,
          },
        },
      });

      return {
        adjustmentTransaction,
        posting,
        ledger,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        replayed: true,
        idempotencyKey,
        message: "Reconcile request already processed",
      };
    }

    throw error;
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: "CASHBOOK_RECONCILE",
    entityType: "CASHBOOK_ACCOUNT",
    entityId: account.id,
    correlationId,
    payload: {
      accountId: account.id,
      reason: payload.reason,
      idempotencyKey,
      systemBalance,
      actualBalance: payload.actualBalance,
      delta,
      adjusted: true,
      adjustmentTransactionId: result.adjustmentTransaction.id,
      cashbookPostingId: result.posting.id,
      ledgerEntryId: result.ledger.id,
    },
  });

  return {
    replayed: false,
    adjusted: true,
    idempotencyKey,
    accountId: account.id,
    systemBalance,
    actualBalance: payload.actualBalance,
    delta,
    adjustmentTransactionId: result.adjustmentTransaction.id,
    cashbookPostingId: result.posting.id,
    ledgerEntryId: result.ledger.id,
  };
}
