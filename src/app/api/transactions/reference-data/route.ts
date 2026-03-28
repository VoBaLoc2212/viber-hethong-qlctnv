import type { NextRequest } from "next/server";

import { listTransactionReferenceData } from "@/modules/transaction";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const data = await listTransactionReferenceData(auth);
    return ok(data, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
