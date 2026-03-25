import type { NextRequest } from "next/server";

import { requireJwtExpiresIn, requireJwtSecret } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma/client";
import type { UserRole } from "@/modules/shared/contracts/domain";
import { AppError } from "@/modules/shared/errors/app-error";

import { verifyAccessToken } from "./access-token";

export type AuthContext = {
  userId: string;
  role: UserRole;
  email: string;
};

function extractBearerToken(request: NextRequest): string {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }

  return token;
}

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const token = extractBearerToken(request);
  const payload = verifyAccessToken(token, requireJwtSecret());

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true },
  });

  if (!user) {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }

  return {
    userId: user.id,
    role: user.role,
    email: user.email,
  };
}

export function requireRole(auth: AuthContext, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(auth.role)) {
    throw new AppError("Forbidden", "FORBIDDEN");
  }
}

export function getJwtExpiresIn() {
  return requireJwtExpiresIn();
}

export function isRoleAllowed(role: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(role);
}
