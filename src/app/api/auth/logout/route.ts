import { NextResponse } from "next/server";

import { AUTH_TOKEN_COOKIE_KEY } from "@/lib/auth/rbac";
import { ok } from "@/modules/shared/http/response";

export async function POST() {
  const response = ok({ success: true }, {});
  response.cookies.set(AUTH_TOKEN_COOKIE_KEY, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
