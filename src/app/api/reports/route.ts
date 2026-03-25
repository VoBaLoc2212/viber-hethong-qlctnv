import type { NextRequest } from "next/server";

import { getReportsOverview } from "@/modules/report";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const data = await getReportsOverview(auth, {
      fromDate: searchParams.get("fromDate") ?? undefined,
      toDate: searchParams.get("toDate") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
    });

    return ok(data, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
