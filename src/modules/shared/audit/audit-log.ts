import { createHash } from "node:crypto";

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
  sourceType?: string;
  sourceId?: string;
};

function canonicalizeJson(value: Prisma.InputJsonValue | undefined): string {
  if (value === undefined) return "null";

  const canonical = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((item) => canonical(item));
    }

    if (input && typeof input === "object") {
      const entries = Object.entries(input as Record<string, unknown>).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      );

      const normalized: Record<string, unknown> = {};
      for (const [key, val] of entries) {
        normalized[key] = canonical(val);
      }
      return normalized;
    }

    return input;
  };

  return JSON.stringify(canonical(value));
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function writeAuditLog(input: AuditLogInput) {
  const payloadCanonical = canonicalizeJson(input.payload);
  const payloadHash = sha256Hex(payloadCanonical);

  const previous = await prisma.auditLog.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { entryHash: true },
  });

  const prevHash = previous?.entryHash ?? null;
  const chainPayload = [
    input.actorId,
    input.action,
    input.entityType,
    input.entityId,
    input.result ?? "SUCCESS",
    input.correlationId ?? "",
    payloadHash,
    prevHash ?? "",
    input.sourceType ?? "USER",
    input.sourceId ?? input.actorId,
  ].join("|");
  const entryHash = sha256Hex(chainPayload);

  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: input.result ?? "SUCCESS",
      correlationId: input.correlationId,
      payload: input.payload,
      payloadHash,
      prevHash,
      entryHash,
      sourceType: input.sourceType ?? "USER",
      sourceId: input.sourceId ?? input.actorId,
    },
  });
}
