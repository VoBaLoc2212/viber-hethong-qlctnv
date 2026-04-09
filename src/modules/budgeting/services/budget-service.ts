import { prisma } from "@/lib/db/prisma/client";
import {
  type AuthContext,
  addMoney,
  assertNotAuditorForMutation,
  calculateAvailable,
  compareMoney,
  isNegativeMoney,
  requireRole,
  writeAuditLog,
} from "@/modules/shared";
import type { Prisma } from "@prisma/client";
import { AppError } from "@/modules/shared/errors/app-error";

import type { BudgetAvailability } from "../types";

type BudgetFilter = {
  page: number;
  limit: number;
  departmentId?: string;
  period?: string;
};

type CreateBudgetPayload = {
  departmentId?: string;
  period?: string;
  amount?: string;
  parentBudgetId?: string | null;
};

type UpdateBudgetPayload = {
  amount?: string;
  parentBudgetId?: string | null;
};

type TransferBudgetPayload = {
  toBudgetId?: string;
  amount?: string;
  reason?: string;
};

function decimalToString(value: Prisma.Decimal | null): string {
  return value?.toFixed(2) ?? "0.00";
}

function toBudgetView(budget: {
  id: string;
  departmentId: string;
  period: string;
  amount: Prisma.Decimal;
  reserved: Prisma.Decimal;
  used: Prisma.Decimal;
  parentBudgetId: string | null;
}) {
  const amount = decimalToString(budget.amount);
  const reserved = decimalToString(budget.reserved);
  const used = decimalToString(budget.used);

  return {
    id: budget.id,
    departmentId: budget.departmentId,
    period: budget.period,
    amount,
    reserved,
    used,
    available: calculateAvailable(amount, reserved, used),
    parentBudgetId: budget.parentBudgetId,
  };
}

async function getPolicyForBudget(budgetId: string) {
  const scoped = await prisma.budgetControlPolicy.findUnique({
    where: { budgetId },
  });

  if (scoped) {
    return scoped;
  }

  const globalPolicy = await prisma.budgetControlPolicy.findFirst({
    where: { budgetId: null },
    orderBy: { createdAt: "asc" },
  });

  return globalPolicy ?? { hardStopEnabled: true, warningThresholdPct: 80 };
}

function ensureMoneyInput(value: string | undefined, fieldName: string) {
  if (!value) {
    throw new AppError(`${fieldName} is required`, "INVALID_INPUT");
  }

  if (compareMoney(value, "0.00") <= 0) {
    throw new AppError(`${fieldName} must be greater than 0`, "INVALID_INPUT");
  }
}

function parseTransferDirection(payload: Prisma.JsonValue | null, budgetId: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = payload as Record<string, unknown>;
  const fromBudgetId = typeof value.fromBudgetId === "string" ? value.fromBudgetId : null;
  const toBudgetId = typeof value.toBudgetId === "string" ? value.toBudgetId : null;

  if (fromBudgetId === budgetId) return "OUT";
  if (toBudgetId === budgetId) return "IN";
  return null;
}

export async function listBudgets(auth: AuthContext, filter: BudgetFilter) {
  requireRole(auth, ["FINANCE_ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.BudgetWhereInput = {
    departmentId: filter.departmentId,
    period: filter.period,
  };

  const [total, rows] = await Promise.all([
    prisma.budget.count({ where }),
    prisma.budget.findMany({
      where,
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toBudgetView),
    meta: { total, page, limit },
  };
}

export async function createBudget(auth: AuthContext, payload: CreateBudgetPayload, correlationId: string) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  ensureMoneyInput(payload.amount, "amount");
  if (!payload.departmentId || !payload.period) {
    throw new AppError("departmentId and period are required", "INVALID_INPUT");
  }

  const department = await prisma.department.findUnique({
    where: { id: payload.departmentId },
    select: { id: true },
  });

  if (!department) {
    throw new AppError("Department not found", "NOT_FOUND");
  }

  if (payload.parentBudgetId) {
    const parentBudget = await prisma.budget.findUnique({
      where: { id: payload.parentBudgetId },
      select: { id: true },
    });

    if (!parentBudget) {
      throw new AppError("Parent budget not found", "NOT_FOUND");
    }
  }

  const budget = await prisma.budget.create({
    data: {
      departmentId: payload.departmentId,
      period: payload.period,
      amount: payload.amount as string,
      reserved: "0.00",
      used: "0.00",
      parentBudgetId: payload.parentBudgetId ?? null,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "BUDGET_CREATE",
    entityType: "BUDGET",
    entityId: budget.id,
    correlationId,
    payload: {
      amount: payload.amount,
      period: payload.period,
      departmentId: payload.departmentId,
      parentBudgetId: payload.parentBudgetId ?? null,
    },
  });

  return toBudgetView(budget);
}

export async function getBudgetById(auth: AuthContext, id: string) {
  requireRole(auth, ["FINANCE_ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);

  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) {
    throw new AppError("Budget not found", "NOT_FOUND");
  }

  return toBudgetView(budget);
}

export async function updateBudgetById(
  auth: AuthContext,
  id: string,
  payload: UpdateBudgetPayload,
  correlationId: string,
) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  ensureMoneyInput(payload.amount, "amount");

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Budget not found", "NOT_FOUND");
  }

  const updated = await prisma.budget.update({
    where: { id },
    data: {
      amount: payload.amount,
      parentBudgetId: payload.parentBudgetId === undefined ? existing.parentBudgetId : payload.parentBudgetId,
    },
  });

  const updatedView = toBudgetView(updated);
  const available = updatedView.available;

  const policy = await getPolicyForBudget(id);
  if (policy.hardStopEnabled && isNegativeMoney(available)) {
    throw new AppError("Budget invariant violated", "CONFLICT");
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: "BUDGET_UPDATE",
    entityType: "BUDGET",
    entityId: id,
    correlationId,
    payload: {
      amount: payload.amount,
      parentBudgetId: payload.parentBudgetId,
    },
  });

  return updatedView;
}

export async function getBudgetHistory(auth: AuthContext, id: string) {
  requireRole(auth, ["FINANCE_ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);

  const budget = await prisma.budget.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!budget) {
    throw new AppError("Budget not found", "NOT_FOUND");
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "BUDGET", entityId: id },
        { entityType: "BUDGET_TRANSFER", payload: { path: ["fromBudgetId"], equals: id } },
        { entityType: "BUDGET_TRANSFER", payload: { path: ["toBudgetId"], equals: id } },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      result: true,
      actorId: true,
      correlationId: true,
      payload: true,
      createdAt: true,
    },
    take: 200,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    result: log.result,
    actorId: log.actorId,
    correlationId: log.correlationId,
    direction: log.entityType === "BUDGET_TRANSFER" ? parseTransferDirection(log.payload, id) : null,
    payload: log.payload,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function deleteBudgetById(auth: AuthContext, id: string, correlationId: string) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) {
    throw new AppError("Budget not found", "NOT_FOUND");
  }

  const [childBudgetCount, transactionCount, recurringCount, transferCount] = await Promise.all([
    prisma.budget.count({ where: { parentBudgetId: id } }),
    prisma.transaction.count({ where: { budgetId: id } }),
    prisma.recurringTransaction.count({ where: { budgetId: id } }),
    prisma.budgetTransfer.count({ where: { OR: [{ fromBudgetId: id }, { toBudgetId: id }] } }),
  ]);

  if (childBudgetCount > 0 || transactionCount > 0 || recurringCount > 0 || transferCount > 0) {
    throw new AppError(
      "Cannot delete budget with existing dependencies",
      "CONFLICT",
      {
        childBudgetCount,
        transactionCount,
        recurringCount,
        transferCount,
      },
      409,
    );
  }

  await prisma.budget.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: "BUDGET_DELETE",
    entityType: "BUDGET",
    entityId: id,
    correlationId,
    payload: {
      departmentId: budget.departmentId,
      period: budget.period,
      amount: decimalToString(budget.amount),
      parentBudgetId: budget.parentBudgetId,
    },
  });

  return {
    id,
    deleted: true,
  };
}

export async function getBudgetStatus(auth: AuthContext, id: string): Promise<BudgetAvailability & {
  percentageUsed: number;
  warning: boolean;
  hardStopEnabled: boolean;
  warningThresholdPct: number;
}> {
  requireRole(auth, ["FINANCE_ADMIN", "MANAGER", "ACCOUNTANT", "AUDITOR"]);

  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) {
    throw new AppError("Budget not found", "NOT_FOUND");
  }

  const amount = decimalToString(budget.amount);
  const reserved = decimalToString(budget.reserved);
  const used = decimalToString(budget.used);
  const available = calculateAvailable(amount, reserved, used);

  const policy = await getPolicyForBudget(id);

  const amountNumber = Number(amount);
  const usedNumber = Number(used);
  const percentageUsed = amountNumber > 0 ? Number(((usedNumber / amountNumber) * 100).toFixed(2)) : 0;

  return {
    budgetId: id,
    amount,
    reserved,
    used,
    available,
    percentageUsed,
    warning: percentageUsed >= policy.warningThresholdPct,
    hardStopEnabled: policy.hardStopEnabled,
    warningThresholdPct: policy.warningThresholdPct,
  };
}

export async function transferBudget(
  auth: AuthContext,
  fromBudgetId: string,
  payload: TransferBudgetPayload,
  idempotencyKey: string | null,
  correlationId: string,
) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  if (!idempotencyKey) {
    throw new AppError("idempotency-key header is required", "INVALID_INPUT");
  }

  ensureMoneyInput(payload.amount, "amount");
  if (!payload.toBudgetId) {
    throw new AppError("toBudgetId is required", "INVALID_INPUT");
  }

  if (payload.toBudgetId === fromBudgetId) {
    throw new AppError("Cannot transfer to same budget", "INVALID_INPUT");
  }

  const existingTransfer = await prisma.budgetTransfer.findUnique({
    where: { idempotencyKey },
  });

  if (existingTransfer) {
    return {
      transferId: existingTransfer.id,
      fromBudgetId: existingTransfer.fromBudgetId,
      toBudgetId: existingTransfer.toBudgetId,
      amount: decimalToString(existingTransfer.amount),
      reason: existingTransfer.reason,
      createdAt: existingTransfer.createdAt.toISOString(),
      idempotencyKey: existingTransfer.idempotencyKey,
      replayed: true,
    };
  }

  const amount = payload.amount as string;

  const result = await prisma.$transaction(async (tx) => {
    const source = await tx.budget.findUnique({ where: { id: fromBudgetId } });
    const target = await tx.budget.findUnique({ where: { id: payload.toBudgetId as string } });

    if (!source || !target) {
      throw new AppError("Budget not found", "NOT_FOUND");
    }

    const sourceAmount = decimalToString(source.amount);
    const sourceReserved = decimalToString(source.reserved);
    const sourceUsed = decimalToString(source.used);
    const sourceAvailable = calculateAvailable(sourceAmount, sourceReserved, sourceUsed);

    if (compareMoney(sourceAvailable, amount) < 0) {
      throw new AppError("Insufficient available budget", "UNPROCESSABLE_ENTITY");
    }

    const sourcePolicy = await getPolicyForBudget(fromBudgetId);
    if (sourcePolicy.hardStopEnabled && compareMoney(sourceAvailable, amount) <= 0) {
      throw new AppError("Hard stop is enabled and budget is exhausted", "UNPROCESSABLE_ENTITY");
    }

    const updatedSourceAmount = addMoney(sourceAmount, `-${amount}`);
    const targetAmount = decimalToString(target.amount);
    const updatedTargetAmount = addMoney(targetAmount, amount);

    await tx.budget.update({
      where: { id: source.id },
      data: { amount: updatedSourceAmount },
    });

    await tx.budget.update({
      where: { id: target.id },
      data: { amount: updatedTargetAmount },
    });

    const transfer = await tx.budgetTransfer.create({
      data: {
        fromBudgetId,
        toBudgetId: payload.toBudgetId as string,
        amount,
        reason: payload.reason,
        createdById: auth.userId,
        idempotencyKey,
      },
    });

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        entryCode: `LED-TRANSFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: "TRANSFER",
        amount,
        currency: "VND",
        referenceType: "BUDGET_TRANSFER",
        referenceId: transfer.id,
        createdById: auth.userId,
        metadata: {
          fromBudgetId,
          toBudgetId: payload.toBudgetId,
          reason: payload.reason ?? null,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "BUDGET_TRANSFER",
        entityType: "BUDGET_TRANSFER",
        entityId: transfer.id,
        correlationId,
        payload: {
          fromBudgetId,
          toBudgetId: payload.toBudgetId,
          amount,
          reason: payload.reason ?? null,
          ledgerEntryId: ledgerEntry.id,
        },
      },
    });

    return {
      transfer,
      ledgerEntry,
    };
  });

  return {
    transferId: result.transfer.id,
    fromBudgetId: result.transfer.fromBudgetId,
    toBudgetId: result.transfer.toBudgetId,
    amount: decimalToString(result.transfer.amount),
    reason: result.transfer.reason,
    createdAt: result.transfer.createdAt.toISOString(),
    idempotencyKey: result.transfer.idempotencyKey,
    ledgerEntryId: result.ledgerEntry.id,
    replayed: false,
  };
}

export async function configureHardStop(
  auth: AuthContext,
  payload: {
    budgetId?: string | null;
    enabled?: boolean;
    warningThresholdPct?: number;
  },
  correlationId: string,
) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  if (typeof payload.enabled !== "boolean") {
    throw new AppError("enabled is required", "INVALID_INPUT");
  }

  const warningThresholdPct = payload.warningThresholdPct ?? 80;
  if (warningThresholdPct < 1 || warningThresholdPct > 100) {
    throw new AppError("warningThresholdPct must be between 1 and 100", "INVALID_INPUT");
  }

  if (payload.budgetId) {
    const budget = await prisma.budget.findUnique({
      where: { id: payload.budgetId },
      select: { id: true },
    });

    if (!budget) {
      throw new AppError("Budget not found", "NOT_FOUND");
    }
  }

  const policy = payload.budgetId
    ? await prisma.budgetControlPolicy.upsert({
        where: { budgetId: payload.budgetId },
        create: {
          budgetId: payload.budgetId,
          hardStopEnabled: payload.enabled,
          warningThresholdPct,
          createdById: auth.userId,
          updatedById: auth.userId,
        },
        update: {
          hardStopEnabled: payload.enabled,
          warningThresholdPct,
          updatedById: auth.userId,
        },
      })
    : await (async () => {
        const globalPolicy = await prisma.budgetControlPolicy.findFirst({
          where: { budgetId: null },
          orderBy: { createdAt: "asc" },
        });

        if (globalPolicy) {
          return prisma.budgetControlPolicy.update({
            where: { id: globalPolicy.id },
            data: {
              hardStopEnabled: payload.enabled,
              warningThresholdPct,
              updatedById: auth.userId,
            },
          });
        }

        return prisma.budgetControlPolicy.create({
          data: {
            budgetId: null,
            hardStopEnabled: payload.enabled,
            warningThresholdPct,
            createdById: auth.userId,
            updatedById: auth.userId,
          },
        });
      })();

  await writeAuditLog({
    actorId: auth.userId,
    action: "BUDGET_POLICY_UPDATE",
    entityType: "BUDGET_CONTROL_POLICY",
    entityId: policy.id,
    correlationId,
    payload: {
      budgetId: policy.budgetId,
      hardStopEnabled: policy.hardStopEnabled,
      warningThresholdPct: policy.warningThresholdPct,
    },
  });

  return {
    id: policy.id,
    budgetId: policy.budgetId,
    hardStopEnabled: policy.hardStopEnabled,
    warningThresholdPct: policy.warningThresholdPct,
    updatedAt: policy.updatedAt.toISOString(),
  };
}
