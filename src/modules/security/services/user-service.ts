import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext, hashPassword, requireRole, writeAuditLog } from "@/modules/shared";
import type { UserRole } from "@/modules/shared/contracts/domain";
import { AppError } from "@/modules/shared/errors/app-error";

import type { UpdateUserPayload } from "../types";

type UserListFilter = {
  page: number;
  limit: number;
  search?: string;
};

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

export async function listUsers(auth: AuthContext, filter: UserListFilter) {
  requireRole(auth, ["FINANCE_ADMIN"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where = filter.search
    ? {
        OR: [
          { username: { contains: filter.search, mode: "insensitive" as const } },
          { email: { contains: filter.search, mode: "insensitive" as const } },
          { fullName: { contains: filter.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toPublicUser),
    meta: { total, page, limit },
  };
}

export async function getUserById(auth: AuthContext, id: string) {
  const isSelf = auth.userId === id;
  if (!isSelf) {
    requireRole(auth, ["FINANCE_ADMIN"]);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("User not found", "NOT_FOUND");
  }

  return toPublicUser(user);
}

export async function updateUserById(
  auth: AuthContext,
  id: string,
  payload: UpdateUserPayload,
  correlationId: string,
) {
  const isSelf = auth.userId === id;
  if (!isSelf) {
    requireRole(auth, ["FINANCE_ADMIN"]);
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing) {
    throw new AppError("User not found", "NOT_FOUND");
  }

  if (payload.role && auth.role !== "FINANCE_ADMIN") {
    throw new AppError("Only finance admin can change role", "FORBIDDEN");
  }

  const data: {
    username?: string;
    email?: string;
    fullName?: string;
    role?: UserRole;
    isActive?: boolean;
    passwordHash?: string;
  } = {};

  if (payload.username) data.username = payload.username;
  if (payload.email) data.email = payload.email;
  if (payload.fullName) data.fullName = payload.fullName;
  if (payload.role) data.role = payload.role;
  if (typeof payload.isActive === "boolean") data.isActive = payload.isActive;
  if (payload.password) data.passwordHash = hashPassword(payload.password);

  if (Object.keys(data).length === 0) {
    throw new AppError("No fields provided for update", "INVALID_INPUT");
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: "USER_UPDATE",
    entityType: "USER",
    entityId: id,
    correlationId,
    payload: {
      changedFields: Object.keys(data),
    },
  });

  return toPublicUser(updated);
}

export async function deleteUserById(auth: AuthContext, id: string, correlationId: string) {
  requireRole(auth, ["FINANCE_ADMIN"]);

  if (auth.userId === id) {
    throw new AppError("Cannot delete current user", "UNPROCESSABLE_ENTITY");
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError("User not found", "NOT_FOUND");
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2003"
    ) {
      throw new AppError(
        "Không thể xóa người dùng này vì đã có dữ liệu phát sinh (audit log / giao dịch / sổ cái). Hãy khóa tài khoản thay vì xóa.",
        "CONFLICT",
      );
    }

    throw error;
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: "USER_DELETE",
    entityType: "USER",
    entityId: id,
    correlationId,
  });
}
