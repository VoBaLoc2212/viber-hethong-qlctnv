import type { NextRequest } from "next/server";

import { listUsers } from "@/modules/security";
import { handleApiError, ok, requireAuth } from "@/modules/shared";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const search = searchParams.get("search") ?? undefined;

    const result = await listUsers(auth, { page, limit, search });
    return ok({ users: result.data }, result.meta);
  } catch (error) {
    return handleApiError(request, error);
  }
}
