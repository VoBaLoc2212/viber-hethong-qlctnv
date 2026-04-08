import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { createTransaction } from "@/modules/transaction";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

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

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return new Response(JSON.stringify({ error: "idempotency-key header is required" }), { status: 400 });
    }

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

      return ok(
        {
          scanned: payload.scanned ?? 0,
          created: payload.created ?? 0,
          createdTransactionIds: payload.createdTransactionIds ?? [],
          failures: payload.failures ?? [],
          replayed: true,
        },
        {},
      );
    }

    const lockAcquired = await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "RECURRING_RUN_LOCK",
        entityType: "RECURRING_BATCH",
        entityId: lockKey,
        correlationId,
        payload: {
          idempotencyKey,
          state: "PROCESSING",
        },
      },
    }).catch(() => null);

    if (!lockAcquired) {
      return new Response(JSON.stringify({ error: "Recurring run with this idempotency key is already in progress" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
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
          correlationId,
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

    await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        action: "RECURRING_RUN",
        entityType: "RECURRING_BATCH",
        entityId: lockKey,
        correlationId,
        payload: {
          idempotencyKey,
          scanned: recurringRows.length,
          created: createdTransactionIds.length,
          createdTransactionIds,
          failures,
        },
      },
    });

    return ok(
      {
        scanned: recurringRows.length,
        created: createdTransactionIds.length,
        createdTransactionIds,
        failures,
        replayed: false,
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
