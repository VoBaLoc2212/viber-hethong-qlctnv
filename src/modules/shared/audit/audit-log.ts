import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";

export type AuditLogInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  result?: string;
  correlationId?: string;
  payload?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: input.result ?? "SUCCESS",
      correlationId: input.correlationId,
      payload: input.payload,
    },
  });
}
