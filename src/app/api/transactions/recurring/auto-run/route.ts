import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { runRecurringTemplates } from "@/modules/transaction/services/recurring-run-service";
import { handleApiError, ok, type AuthContext } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";
import { getCorrelationId } from "@/modules/shared/http/request";

function requireCronSecret(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    throw new AppError("CRON_SECRET is not configured", "INTERNAL_SERVER_ERROR", undefined, 500);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  if (!token || token !== expected) {
    throw new AppError("Unauthorized cron trigger", "UNAUTHORIZED", undefined, 401);
  }
}

async function buildSystemAuthContext(): Promise<AuthContext> {
  const actorUserId = process.env.RECURRING_CRON_ACTOR_USER_ID?.trim();
  if (!actorUserId) {
    throw new AppError("RECURRING_CRON_ACTOR_USER_ID is not configured", "INTERNAL_SERVER_ERROR", undefined, 500);
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!actor || !actor.isActive) {
    throw new AppError("Recurring cron actor user is invalid or inactive", "INTERNAL_SERVER_ERROR", undefined, 500);
  }

  if (actor.role !== "ACCOUNTANT" && actor.role !== "FINANCE_ADMIN") {
    throw new AppError("Recurring cron actor must have ACCOUNTANT or FINANCE_ADMIN role", "INTERNAL_SERVER_ERROR", undefined, 500);
  }

  return {
    userId: actor.id,
    role: actor.role,
    email: actor.email,
  };
}

function buildCronIdempotencyKey(now: Date) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");

  return `auto-recurring-${yyyy}${mm}${dd}${hh}`;
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    requireCronSecret(request);

    const now = new Date();
    const idempotencyKey = buildCronIdempotencyKey(now);

    try {
      const auth = await buildSystemAuthContext();
      const result = await runRecurringTemplates({
        auth,
        idempotencyKey,
        correlationId,
      });

      return ok(
        {
          mode: "AUTO_CRON",
          idempotencyKey,
          ...result,
        },
        { scope: "RECURRING_RUN_AUTO", replayed: result.replayed },
      );
    } catch (error) {
      if (error instanceof Error && error.message === "RECURRING_RUN_IN_PROGRESS") {
        return new Response(
          JSON.stringify({ error: "Recurring auto-run is already in progress for this idempotency window" }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      throw error;
    }
  } catch (error) {
    return handleApiError(request, error);
  }
}
