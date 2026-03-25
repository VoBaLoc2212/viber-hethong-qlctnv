import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { type AuthContext, requireRole, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

type LogFilter = {
  page: number;
  limit: number;
  entityType?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
  userId?: string;
};

type ImmutableLogPayload = {
  action?: string;
  entityType?: string;
  entityId?: string;
  result?: string;
  payload?: unknown;
};

export async function listLogs(auth: AuthContext, filter: LogFilter) {
  requireRole(auth, ["FINANCE_ADMIN", "AUDITOR"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    entityType: filter.entityType,
    entityId: filter.entityId,
    actorId: filter.userId,
    createdAt:
      filter.fromDate || filter.toDate
        ? {
            gte: filter.fromDate ? new Date(filter.fromDate) : undefined,
            lte: filter.toDate ? new Date(filter.toDate) : undefined,
          }
        : undefined,
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        actor: {
          select: { id: true, username: true, fullName: true, email: true, role: true },
        },
      },
    }),
  ]);

  return {
    data: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      result: row.result,
      correlationId: row.correlationId,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor,
    })),
    meta: { total, page, limit },
  };
}

async function createImmutableLogEntry(
  actorId: string,
  payload: ImmutableLogPayload,
  correlationId: string,
  source?: { sourceType: string; sourceId: string },
) {
  if (!payload.action || !payload.entityType || !payload.entityId) {
    throw new AppError("Missing required fields", "INVALID_INPUT");
  }

  const log = await writeAuditLog({
    actorId,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    result: payload.result ?? "SUCCESS",
    correlationId,
    payload: payload.payload as Prisma.InputJsonValue | undefined,
    sourceType: source?.sourceType,
    sourceId: source?.sourceId,
  });

  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    result: log.result,
    correlationId: log.correlationId,
    payload: log.payload,
    sourceType: log.sourceType,
    sourceId: log.sourceId,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function createImmutableLog(auth: AuthContext, payload: ImmutableLogPayload, correlationId: string) {
  requireRole(auth, ["FINANCE_ADMIN", "ACCOUNTANT"]);

  return createImmutableLogEntry(auth.userId, payload, correlationId, {
    sourceType: "USER",
    sourceId: auth.userId,
  });
}

export async function createInternalImmutableLog(
  payload: ImmutableLogPayload,
  correlationId: string,
  source: { serviceId: string; actorId: string },
) {
  return createImmutableLogEntry(source.actorId, payload, correlationId, {
    sourceType: "SERVICE",
    sourceId: source.serviceId,
  });
}
