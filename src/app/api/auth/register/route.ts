import type { NextRequest } from "next/server";

import { register } from "@/modules/security";
import { created, handleApiError, readJsonBody, requireAuth } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const auth = await requireAuth(request);
    const body = await readJsonBody<{
      username?: string;
      password?: string;
      role?: "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR";
      email?: string;
      fullName?: string;
    }>(request);

    const user = await register(
      auth,
      {
        username: body.username ?? "",
        password: body.password ?? "",
        role: (body.role ?? "EMPLOYEE") as "EMPLOYEE" | "MANAGER" | "ACCOUNTANT" | "FINANCE_ADMIN" | "AUDITOR",
        email: body.email ?? "",
        fullName: body.fullName,
      },
      correlationId,
    );

    return created(user, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
