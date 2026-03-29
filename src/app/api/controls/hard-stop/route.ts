import type { NextRequest } from "next/server";

import { configureHardStop } from "@/modules/budgeting";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    const body = await readJsonBody<{
      budgetId?: string | null;
      enabled?: boolean;
      warningThresholdPct?: number;
    }>(request);

    const policy = await configureHardStop(auth, body, correlationId);
    return ok(policy, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
