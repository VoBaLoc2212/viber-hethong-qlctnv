import type { NextRequest } from "next/server";

import { updateFxRateById } from "@/modules/fx";
import { handleApiError, ok, readJsonBody, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    const { id } = await params;
    const body = await readJsonBody<{
      rate?: string;
      source?: string;
      rateDate?: string;
    }>(request);

    const rate = await updateFxRateById(auth, id, body, correlationId);
    return ok(rate, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
