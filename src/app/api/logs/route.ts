import type { NextRequest } from "next/server";

import { listLogs } from "@/modules/security";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");

    const result = await listLogs(auth, {
      page,
      limit,
      entityType: searchParams.get("entityType") ?? undefined,
      entityId: searchParams.get("entityId") ?? undefined,
      fromDate: searchParams.get("fromDate") ?? undefined,
      toDate: searchParams.get("toDate") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
    });

    return ok({ logs: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}
