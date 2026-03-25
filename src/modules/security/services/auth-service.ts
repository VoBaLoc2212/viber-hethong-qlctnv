import { prisma } from "@/lib/db/prisma/client";
import {
  type AuthContext,
  getJwtExpiresIn,
  hashPassword,
  requireRole,
  signAccessToken,
  verifyPassword,
  writeAuditLog,
} from "@/modules/shared";
import type { UserRole } from "@/modules/shared/contracts/domain";
import { AppError } from "@/modules/shared/errors/app-error";

import type { LoginPayload, RegisterPayload } from "../types";

type PublicUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

function toPublicUser(user: {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function login(payload: LoginPayload, jwtSecret: string, correlationId: string) {
  if (!payload.username || !payload.password) {
    throw new AppError("Username and password are required", "INVALID_INPUT");
  }

  if (payload.password.length < 8) {
    throw new AppError("Password must be at least 8 characters", "INVALID_INPUT");
  }

  const user = await prisma.user.findUnique({
    where: { username: payload.username },
  });

  if (!user || !user.isActive || !verifyPassword(payload.password, user.passwordHash)) {
    throw new AppError("Invalid username or password", "UNAUTHORIZED");
  }

  const token = signAccessToken(
    { sub: user.id, role: user.role },
    jwtSecret,
    getJwtExpiresIn(),
  );

  await writeAuditLog({
    actorId: user.id,
    action: "AUTH_LOGIN",
    entityType: "USER",
    entityId: user.id,
    correlationId,
    result: "SUCCESS",
  });

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function register(
  auth: AuthContext,
  payload: RegisterPayload,
  correlationId: string,
) {
  requireRole(auth, ["FINANCE_ADMIN"]);

  if (!payload.username || !payload.password || !payload.role || !payload.email) {
    throw new AppError("Missing required fields", "INVALID_INPUT");
  }

  if (payload.password.length < 8) {
    throw new AppError("Password must be at least 8 characters", "INVALID_INPUT");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: payload.username }, { email: payload.email }],
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("Username or email already exists", "CONFLICT");
  }

  const user = await prisma.user.create({
    data: {
      username: payload.username,
      email: payload.email,
      fullName: payload.fullName ?? payload.username,
      passwordHash: hashPassword(payload.password),
      role: payload.role,
      isActive: true,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "USER_REGISTER",
    entityType: "USER",
    entityId: user.id,
    correlationId,
    payload: {
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });

  return toPublicUser(user);
}

export async function getCurrentUser(auth: AuthContext) {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
  });

  if (!user) {
    throw new AppError("Unauthorized", "UNAUTHORIZED");
  }

  return toPublicUser(user);
}
