import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { addMoney, type AuthContext, requireRole, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { compareMoney } from "@/modules/shared/finance/decimal";

function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function buildIdempotencyCodeSuffix(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12).toUpperCase();
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function listCashbook(auth: AuthContext, params: { accountId?: string; page: number; limit: number }) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN", "AUDITOR"]);

  const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
  const limit = Number.isFinite(params.limit) && params.limit > 0 ? Math.min(params.limit, 100) : 30;

  const [accounts, postings] = await Promise.all([
    prisma.cashbookAccount.findMany({
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        updatedAt: true,
      },
    }),
    prisma.cashbookPosting.findMany({
      where: params.accountId ? { accountId: params.accountId } : undefined,
      orderBy: [{ postedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        accountId: true,
        transactionId: true,
        direction: true,
        amount: true,
        postedAt: true,
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
      direction: posting.direction as "IN" | "OUT",
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
  };
}

type ReconcilePayload = {
  accountId?: string;
  actualBalance?: string;
  reason?: string;
};

export async function reconcileCashbook(
  auth: AuthContext,
  payload: ReconcilePayload,
  idempotencyKey: string | null,
  correlationId: string,
) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  if (!idempotencyKey) {
    throw new AppError("idempotency-key header is required", "INVALID_INPUT");
  }

  const accountId = payload.accountId?.trim();
  if (!accountId) throw new AppError("accountId is required", "INVALID_INPUT");

  const actualBalance = payload.actualBalance?.trim();
  if (!actualBalance) throw new AppError("actualBalance is required", "INVALID_INPUT");

  const reason = payload.reason?.trim();
  if (!reason) throw new AppError("reason is required", "INVALID_INPUT");

  try {
    return await prisma.$transaction(async (db) => {
      const existing = await db.auditLog.findFirst({
        where: {
          action: "CASHBOOK_RECONCILE",
          entityType: "CASHBOOK_ACCOUNT",
          entityId: accountId,
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
          adjusted: false,
          idempotencyKey,
          message: "Replayed",
        };
      }

      const account = await db.cashbookAccount.findUnique({
        where: { id: accountId },
        select: { id: true, balance: true },
      });

      if (!account) throw new AppError("Cashbook account not found", "NOT_FOUND");

      const systemBalance = decimalToString(account.balance);
      const delta = addMoney(actualBalance, `-${systemBalance}`);

      if (compareMoney(delta, "0.00") === 0) {
        await writeAuditLog({
          actorId: auth.userId,
          action: "CASHBOOK_RECONCILE",
          entityType: "CASHBOOK_ACCOUNT",
          entityId: accountId,
          correlationId,
          payload: {
            idempotencyKey,
            accountId,
            systemBalance,
            actualBalance,
            delta,
            adjusted: false,
            reason,
          },
        });

        return {
          replayed: false,
          adjusted: false,
          idempotencyKey,
          accountId,
          systemBalance,
          actualBalance,
          delta,
          message: "No adjustment needed",
        };
      }

      const direction = compareMoney(delta, "0.00") > 0 ? "IN" : "OUT";
      const adjustmentAmount = delta.startsWith("-") ? delta.slice(1) : delta;

      const nextBalance = addMoney(systemBalance, delta);
      await db.cashbookAccount.update({
        where: { id: accountId },
        data: { balance: nextBalance },
      });

      const suffix = buildIdempotencyCodeSuffix(`${accountId}:${idempotencyKey}`);
      const adjustmentTx = await db.transaction.create({
        data: {
          code: `TXN-CB-ADJ-${suffix}`,
          type: direction === "IN" ? "INCOME" : "EXPENSE",
          status: "EXECUTED",
          amount: adjustmentAmount,
          currency: "VND",
          date: new Date(),
          description: `Cashbook reconcile adjustment: ${reason}`,
          createdById: auth.userId,
        },
      });

      const posting = await db.cashbookPosting.create({
        data: {
          accountId,
          transactionId: adjustmentTx.id,
          direction,
          amount: adjustmentAmount,
        },
      });

      const ledger = await db.ledgerEntry.create({
        data: {
          entryCode: `LED-CB-ADJ-${suffix}`,
          type: "ADJUSTMENT",
          amount: adjustmentAmount,
          currency: "VND",
          referenceType: "CASHBOOK_ACCOUNT",
          referenceId: accountId,
          createdById: auth.userId,
          metadata: {
            accountId,
            transactionId: adjustmentTx.id,
            idempotencyKey,
            reason,
            direction,
            systemBalance,
            actualBalance,
            delta,
          },
        },
      });

      await writeAuditLog({
        actorId: auth.userId,
        action: "CASHBOOK_RECONCILE",
        entityType: "CASHBOOK_ACCOUNT",
        entityId: accountId,
        correlationId,
        payload: {
          idempotencyKey,
          accountId,
          systemBalance,
          actualBalance,
          delta,
          adjusted: true,
          reason,
          adjustmentTransactionId: adjustmentTx.id,
          cashbookPostingId: posting.id,
          ledgerEntryId: ledger.id,
        },
      });

      return {
        replayed: false,
        adjusted: true,
        idempotencyKey,
        accountId,
        systemBalance,
        actualBalance,
        delta,
        adjustmentTransactionId: adjustmentTx.id,
        cashbookPostingId: posting.id,
        ledgerEntryId: ledger.id,
      };
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      return {
        replayed: true,
        adjusted: false,
        idempotencyKey,
        message: "Replayed",
      };
    }

    throw error;
  }
}
