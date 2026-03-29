import type { NextRequest } from "next/server";

import { listCashbook } from "@/modules/cashbook";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const result = await listCashbook(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      accountId: searchParams.get("accountId") ?? undefined,
    });

    return ok(
      {
        accounts: result.accounts,
        postings: result.postings,
      },
      result.meta,
    );
  } catch (error) {
    return handleApiError(request, error);
  }
}
