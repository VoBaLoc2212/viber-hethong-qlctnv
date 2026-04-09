import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext } from "@/modules/shared";

import { createTransaction } from "./transaction-service";

function addByFrequency(date: Date, frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY") {
  const next = new Date(date);

  switch (frequency) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case "QUARTERLY":
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    case "ANNUALLY":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    default:
      return next;
  }
}

function hashIdempotencyKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export type RecurringRunResult = {
  scanned: number;
  created: number;
  createdTransactionIds: string[];
  failures: Array<{ recurringId: string; reason: string }>;
  replayed: boolean;
};

type RunRecurringTemplatesInput = {
  auth: AuthContext;
  idempotencyKey: string;
  correlationId?: string;
};

export async function runRecurringTemplates(input: RunRecurringTemplatesInput): Promise<RecurringRunResult> {
  const { auth, idempotencyKey, correlationId } = input;
  const lockKey = hashIdempotencyKey(`recurring-run:${idempotencyKey}`);

  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "RECURRING_RUN",
      entityType: "RECURRING_BATCH",
      entityId: lockKey,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const payload = (existing.payload ?? {}) as {
      scanned?: number;
      created?: number;
      createdTransactionIds?: string[];
      failures?: Array<{ recurringId: string; reason: string }>;
    };

    return {
      scanned: payload.scanned ?? 0,
      created: payload.created ?? 0,
      createdTransactionIds: payload.createdTransactionIds ?? [],
      failures: payload.failures ?? [],
      replayed: true,
    };
  }

  try {
    await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "RECURRING_RUN_LOCK",
        entityType: "RECURRING_BATCH",
        entityId: lockKey,
        correlationId,
        processingStatus: "PROCESSING",
        processingUpdatedAt: new Date(),
        payload: {
          idempotencyKey,
          state: "PROCESSING",
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("RECURRING_RUN_IN_PROGRESS");
    }

    throw error;
  }

  const now = new Date();
  const recurringRows = await prisma.recurringTransaction.findMany({
    where: {
      active: true,
      nextRunAt: {
        lte: now,
      },
    },
    orderBy: [{ nextRunAt: "asc" }],
    take: 100,
  });

  const createdTransactionIds: string[] = [];
  const failures: Array<{ recurringId: string; reason: string }> = [];

  for (const recurring of recurringRows) {
    try {
      const createdTx = await createTransaction(
        auth,
        {
          type: recurring.type,
          amount: recurring.amount.toFixed(2),
          budgetId: recurring.budgetId,
          departmentId: recurring.departmentId,
          date: recurring.nextRunAt.toISOString(),
          description: `Recurring: ${recurring.name}`,
          recurringSourceId: recurring.id,
        },
        correlationId ?? "",
      );

      createdTransactionIds.push(createdTx.id);

      await prisma.recurringTransaction.update({
        where: { id: recurring.id },
        data: {
          lastRunAt: recurring.nextRunAt,
          nextRunAt: addByFrequency(recurring.nextRunAt, recurring.frequency),
        },
      });
    } catch (error) {
      failures.push({
        recurringId: recurring.id,
        reason:
          typeof error === "object" && error && "message" in error
            ? String((error as { message: unknown }).message)
            : "Unknown error",
      });
    }
  }

  const finalPayload = {
    idempotencyKey,
    scanned: recurringRows.length,
    created: createdTransactionIds.length,
    createdTransactionIds,
    failures,
  };

  await prisma.auditLog.updateMany({
    where: {
      action: "RECURRING_RUN_LOCK",
      entityType: "RECURRING_BATCH",
      entityId: lockKey,
    },
    data: {
      processingStatus: "COMPLETED",
      processingUpdatedAt: new Date(),
      payload: {
        ...finalPayload,
        state: "COMPLETED",
      },
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "RECURRING_RUN",
        entityType: "RECURRING_BATCH",
        entityId: lockKey,
        correlationId,
        payload: finalPayload,
      },
    });
  } catch {
    // Do not fail the API response when summary audit write fails after transactions were already created.
  }

  return {
    scanned: recurringRows.length,
    created: createdTransactionIds.length,
    createdTransactionIds,
    failures,
    replayed: false,
  };
}
