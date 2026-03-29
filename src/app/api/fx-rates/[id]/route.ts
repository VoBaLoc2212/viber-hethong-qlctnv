import type { NextRequest } from "next/server";

import { AppError, handleApiError, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    await params;
    throw new AppError("Manual FX update is disabled. Rates are auto-updated from web source.", "FORBIDDEN");
  } catch (error) {
    return handleApiError(request, error);
  }
}
