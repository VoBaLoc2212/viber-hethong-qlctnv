import type { NextRequest } from "next/server";

import { listLedgerEntries } from "@/modules/ledger";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const result = await listLedgerEntries(auth, {
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "20"),
      referenceType: searchParams.get("referenceType") ?? undefined,
      referenceId: searchParams.get("referenceId") ?? undefined,
    });

    return ok({ entries: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}
