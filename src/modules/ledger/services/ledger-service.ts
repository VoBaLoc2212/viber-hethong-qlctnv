import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { addMoney, assertNotAuditorForMutation, calculateAvailable, compareMoney, type AuthContext, requireRole, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

type LedgerFilter = {
  page: number;
  limit: number;
  referenceType?: string;
  referenceId?: string;
};

function decimalToString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export async function listLedgerEntries(auth: AuthContext, filter: LedgerFilter) {
  requireRole(auth, ["FINANCE_ADMIN", "ACCOUNTANT", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.LedgerEntryWhereInput = {
    referenceType: filter.referenceType,
    referenceId: filter.referenceId,
  };

  const [total, rows] = await Promise.all([
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        reconciledBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        reversalOf: {
          select: {
            id: true,
            entryCode: true,
          },
        },
      },
    }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      entryCode: row.entryCode,
      type: row.type,
      amount: decimalToString(row.amount),
      currency: row.currency,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      reversalOfId: row.reversalOfId,
      reversalOfEntryCode: row.reversalOf?.entryCode ?? null,
      fxCurrency: row.fxCurrency,
      fxAmount: row.fxAmount ? decimalToString(row.fxAmount) : null,
      fxRate: row.fxRate ? row.fxRate.toFixed(6) : null,
      baseCurrency: row.baseCurrency,
      baseAmount: row.baseAmount ? decimalToString(row.baseAmount) : null,
      fxRateProvider: row.fxRateProvider,
      fxRateFetchedAt: row.fxRateFetchedAt?.toISOString() ?? null,
      reconciliationStatus: row.reconciliationStatus,
      reconciledAt: row.reconciledAt?.toISOString() ?? null,
      reconciledById: row.reconciledById,
      reconciliationRef: row.reconciliationRef,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      reconciledBy: row.reconciledBy,
    })),
    meta: { total, page, limit },
  };
}

export async function reverseLedgerEntry(
  auth: AuthContext,
  id: string,
  reason: string,
  idempotencyKey: string | null,
  correlationId: string,
) {
  requireRole(auth, ["FINANCE_ADMIN", "ACCOUNTANT"]);
  assertNotAuditorForMutation(auth);

  if (!idempotencyKey) {
    throw new AppError("idempotency-key header is required", "INVALID_INPUT");
  }

  if (!reason) {
    throw new AppError("reason is required", "INVALID_INPUT");
  }

  const existingReversal = await prisma.ledgerEntry.findFirst({
    where: { reversalOfId: id },
  });

  if (existingReversal) {
    return {
      reversalEntryId: existingReversal.id,
      targetEntryId: id,
      replayed: true,
      idempotencyKey,
      createdAt: existingReversal.createdAt.toISOString(),
    };
  }

  const target = await prisma.ledgerEntry.findUnique({ where: { id } });
  if (!target) {
    throw new AppError("Ledger entry not found", "NOT_FOUND");
  }

  if (target.type === "REVERSAL") {
    throw new AppError("Cannot reverse reversal entry", "UNPROCESSABLE_ENTITY");
  }

  const reversal = await prisma.$transaction(async (tx) => {
    const created = await tx.ledgerEntry.create({
      data: {
        entryCode: `LED-REVERSAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "REVERSAL",
        amount: target.amount,
        currency: target.currency,
        referenceType: target.referenceType,
        referenceId: target.referenceId,
        reversalOfId: target.id,
        createdById: auth.userId,
        fxCurrency: target.fxCurrency,
        fxAmount: target.fxAmount,
        fxRate: target.fxRate,
        baseCurrency: target.baseCurrency,
        baseAmount: target.baseAmount,
        fxRateProvider: target.fxRateProvider,
        fxRateFetchedAt: target.fxRateFetchedAt,
        metadata: {
          reason,
          idempotencyKey,
          sourceEntryCode: target.entryCode,
        },
      },
    });

    if (target.referenceType === "TRANSACTION") {
      const transaction = await tx.transaction.findUnique({ where: { id: target.referenceId } });
      if (transaction) {
        if (transaction.status !== "EXECUTED") {
          throw new AppError("Only EXECUTED transaction can be reversed", "UNPROCESSABLE_ENTITY");
        }

        if (transaction.type === "EXPENSE") {
          if (!transaction.budgetId) {
            throw new AppError("Missing budget reference", "CONFLICT");
          }

          const budget = await tx.budget.findUnique({ where: { id: transaction.budgetId } });
          if (!budget) {
            throw new AppError("Budget not found", "NOT_FOUND");
          }

          const amount = decimalToString(budget.amount);
          const reserved = decimalToString(budget.reserved);
          const used = decimalToString(budget.used);
          const txAmount = decimalToString(transaction.amount);

          if (compareMoney(used, txAmount) < 0) {
            throw new AppError("Budget used amount is inconsistent", "CONFLICT");
          }

          const nextUsed = addMoney(used, `-${txAmount}`);
          const nextAvailable = calculateAvailable(amount, reserved, nextUsed);

          await tx.budget.update({
            where: { id: budget.id },
            data: { used: nextUsed },
          });

          await tx.auditLog.create({
            data: {
              actorId: auth.userId,
              action: "BUDGET_RELEASE",
              entityType: "BUDGET",
              entityId: budget.id,
              correlationId,
              payload: {
                reason,
                source: "LEDGER_REVERSAL",
                transactionId: transaction.id,
                amount: txAmount,
                availableAfterRelease: nextAvailable,
              },
            },
          });
        }

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "REVERSED" },
        });

        await tx.auditLog.create({
          data: {
            actorId: auth.userId,
            action: "TRANSACTION_REVERSE",
            entityType: "TRANSACTION",
            entityId: transaction.id,
            correlationId,
            payload: {
              targetEntryId: target.id,
              reversalEntryId: created.id,
              reason,
              idempotencyKey,
            },
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "LEDGER_REVERSAL",
        entityType: "LEDGER_ENTRY",
        entityId: created.id,
        correlationId,
        payload: {
          targetEntryId: target.id,
          targetEntryCode: target.entryCode,
          reason,
          idempotencyKey,
        },
      },
    });

    return created;
  });

  return {
    reversalEntryId: reversal.id,
    targetEntryId: id,
    replayed: false,
    idempotencyKey,
    createdAt: reversal.createdAt.toISOString(),
  };
}
