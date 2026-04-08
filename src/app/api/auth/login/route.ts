import type { NextRequest } from "next/server";

import { requireJwtSecret } from "@/lib/auth/jwt";
import { AUTH_TOKEN_COOKIE_KEY } from "@/lib/auth/rbac";
import { login } from "@/modules/security";
import { handleApiError, readJsonBody } from "@/modules/shared";
import { getCorrelationId } from "@/modules/shared/http/request";
import { ok } from "@/modules/shared/http/response";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const body = await readJsonBody<{ username?: string; password?: string }>(request);
    const result = await login(
      {
        username: body.username ?? "",
        password: body.password ?? "",
      },
      requireJwtSecret(),
      correlationId,
    );

    const response = ok(result, {});
    response.cookies.set(AUTH_TOKEN_COOKIE_KEY, result.token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    return handleApiError(request, error);
  }
}
