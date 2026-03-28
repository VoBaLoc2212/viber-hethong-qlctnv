import type { NextRequest } from "next/server";

import { runDueRecurringTemplates } from "@/modules/transaction";
import { created, handleApiError, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const result = await runDueRecurringTemplates(auth, correlationId);
    return created(result, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
