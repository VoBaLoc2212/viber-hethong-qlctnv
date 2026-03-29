import type { RecurringFrequency, TransactionType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { AppError } from "@/modules/shared/errors/app-error";
import { type AuthContext, compareMoney, requireRole } from "@/modules/shared";

import { createTransaction } from "./transaction-service";

type RecurringFilter = {
  page: number;
  limit: number;
  active?: boolean;
};

type CreateRecurringPayload = {
  name?: string;
  type?: TransactionType;
  amount?: string;
  frequency?: RecurringFrequency;
  nextRunAt?: string;
  budgetId?: string | null;
  departmentId?: string | null;
  active?: boolean;
};

type UpdateRecurringPayload = {
  name?: string;
  amount?: string;
  frequency?: RecurringFrequency;
  nextRunAt?: string;
  budgetId?: string | null;
  departmentId?: string | null;
  active?: boolean;
};

function addByFrequency(base: Date, frequency: RecurringFrequency): Date {
  const next = new Date(base);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      return next;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      return next;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      return next;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      return next;
    case "ANNUALLY":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return next;
  }
}

function toRecurringView(row: {
  id: string;
  name: string;
  type: TransactionType;
  amount: { toFixed: (fractionDigits?: number) => string };
  frequency: RecurringFrequency;
  nextRunAt: Date;
  lastRunAt: Date | null;
  active: boolean;
  budgetId: string | null;
  departmentId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    amount: row.amount.toFixed(2),
    frequency: row.frequency,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    active: row.active,
    budgetId: row.budgetId,
    departmentId: row.departmentId,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecurringTemplates(auth: AuthContext, filter: RecurringFilter) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN", "MANAGER", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where = {
    active: filter.active,
  };

  const [total, rows] = await Promise.all([
    prisma.recurringTransaction.count({ where }),
    prisma.recurringTransaction.findMany({
      where,
      orderBy: { nextRunAt: "asc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toRecurringView),
    meta: { total, page, limit },
  };
}

export async function createRecurringTemplate(auth: AuthContext, payload: CreateRecurringPayload) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  if (!payload.name?.trim()) {
    throw new AppError("name is required", "INVALID_INPUT");
  }

  if (!payload.type) {
    throw new AppError("type is required", "INVALID_INPUT");
  }

  if (!payload.amount || compareMoney(payload.amount, "0.00") <= 0) {
    throw new AppError("amount must be greater than 0", "INVALID_INPUT");
  }

  if (!payload.frequency) {
    throw new AppError("frequency is required", "INVALID_INPUT");
  }

  const nextRunAt = payload.nextRunAt ? new Date(payload.nextRunAt) : new Date();
  if (Number.isNaN(nextRunAt.getTime())) {
    throw new AppError("nextRunAt is invalid", "INVALID_INPUT");
  }

  if (payload.type === "EXPENSE" && !payload.budgetId) {
    throw new AppError("budgetId is required for EXPENSE recurring template", "INVALID_INPUT");
  }

  const created = await prisma.recurringTransaction.create({
    data: {
      name: payload.name.trim(),
      type: payload.type,
      amount: payload.amount,
      currency: "VND",
      frequency: payload.frequency,
      nextRunAt,
      active: payload.active ?? true,
      budgetId: payload.budgetId ?? null,
      departmentId: payload.departmentId ?? null,
      createdById: auth.userId,
    },
  });

  return toRecurringView(created);
}

export async function updateRecurringTemplate(auth: AuthContext, id: string, payload: UpdateRecurringPayload) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  const existing = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Recurring template not found", "NOT_FOUND");
  }

  const nextRunAt = payload.nextRunAt ? new Date(payload.nextRunAt) : undefined;
  if (payload.nextRunAt && (!nextRunAt || Number.isNaN(nextRunAt.getTime()))) {
    throw new AppError("nextRunAt is invalid", "INVALID_INPUT");
  }

  if (payload.amount && compareMoney(payload.amount, "0.00") <= 0) {
    throw new AppError("amount must be greater than 0", "INVALID_INPUT");
  }

  const updated = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      name: payload.name ?? existing.name,
      amount: payload.amount ?? existing.amount,
      frequency: payload.frequency ?? existing.frequency,
      nextRunAt: nextRunAt ?? existing.nextRunAt,
      budgetId: payload.budgetId === undefined ? existing.budgetId : payload.budgetId,
      departmentId: payload.departmentId === undefined ? existing.departmentId : payload.departmentId,
      active: payload.active ?? existing.active,
    },
  });

  return toRecurringView(updated);
}

export async function deleteRecurringTemplate(auth: AuthContext, id: string) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  const existing = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Recurring template not found", "NOT_FOUND");
  }

  await prisma.recurringTransaction.delete({ where: { id } });

  return {
    id,
    deleted: true,
  };
}

export async function runDueRecurringTemplates(auth: AuthContext, correlationId: string) {
  requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

  const lockRows = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext('recurring_due_templates_runner')) AS acquired
  `;

  const lockAcquired = lockRows[0]?.acquired === true;
  if (!lockAcquired) {
    return {
      scanned: 0,
      created: 0,
      createdTransactionIds: [],
      failures: [],
    };
  }

  try {
    const now = new Date();
    const dueItems = await prisma.recurringTransaction.findMany({
      where: {
        active: true,
        nextRunAt: {
          lte: now,
        },
      },
      orderBy: { nextRunAt: "asc" },
      take: 50,
    });

    const createdTransactionIds: string[] = [];
    const failures: Array<{ recurringId: string; reason: string }> = [];

    for (const item of dueItems) {
      try {
        const created = await createTransaction(
          auth,
          {
            type: item.type,
            amount: item.amount.toFixed(2),
            budgetId: item.budgetId,
            departmentId: item.departmentId,
            date: now.toISOString(),
            description: `Recurring: ${item.name}`,
            recurringSourceId: item.id,
          },
          correlationId,
        );

        createdTransactionIds.push(created.id);

        await prisma.recurringTransaction.update({
          where: { id: item.id },
          data: {
            lastRunAt: now,
            nextRunAt: addByFrequency(item.nextRunAt, item.frequency),
          },
        });
      } catch (error) {
        const reason =
          typeof error === "object" && error && "message" in error
            ? String((error as { message: unknown }).message)
            : "Unknown error";
        failures.push({ recurringId: item.id, reason });
      }
    }

    return {
      scanned: dueItems.length,
      created: createdTransactionIds.length,
      createdTransactionIds,
      failures,
    };
  } finally {
    await prisma.$executeRaw`
      SELECT pg_advisory_unlock(hashtext('recurring_due_templates_runner'))
    `;
  }
}
