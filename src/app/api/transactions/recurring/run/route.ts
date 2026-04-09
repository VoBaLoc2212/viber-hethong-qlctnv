import type { NextRequest } from "next/server";

import { runRecurringTemplates } from "@/modules/transaction/services/recurring-run-service";
import { handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["ACCOUNTANT", "FINANCE_ADMIN"]);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) {
      return new Response(JSON.stringify({ error: "idempotency-key header is required" }), { status: 400 });
    }

    try {
      const result = await runRecurringTemplates({
        auth,
        idempotencyKey,
        correlationId,
      });

      return ok(result, { scope: "RECURRING_RUN", replayed: result.replayed });
    } catch (error) {
      if (error instanceof Error && error.message === "RECURRING_RUN_IN_PROGRESS") {
        return new Response(
          JSON.stringify({ error: "Recurring run with this idempotency key is already in progress" }),
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
