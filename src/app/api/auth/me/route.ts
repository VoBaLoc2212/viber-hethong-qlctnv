import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/modules/security";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const user = await getCurrentUser(auth);
    return ok(user, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
