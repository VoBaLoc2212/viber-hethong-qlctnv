import type { NextRequest } from "next/server";

import { listFxRates } from "@/modules/fx";
import { AppError, handleApiError, ok, requireAuth, requireRole } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    const { searchParams } = new URL(request.url);

    const result = await listFxRates(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      fromCurrency: searchParams.get("fromCurrency") ?? undefined,
      toCurrency: searchParams.get("toCurrency") ?? undefined,
      source: searchParams.get("source") ?? undefined,
      rateDateFrom: searchParams.get("rateDateFrom") ?? undefined,
      rateDateTo: searchParams.get("rateDateTo") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });

    return ok(
      {
        data: result.data,
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
      },
      {},
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: NextRequest) {
  getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    requireRole(auth, ["FINANCE_ADMIN"]);
    throw new AppError("Manual FX update is disabled. Rates are auto-updated from web source.", "FORBIDDEN");
  } catch (error) {
    return handleApiError(request, error);
  }
}
