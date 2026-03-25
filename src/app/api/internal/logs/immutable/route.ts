import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma/client";
import { createInternalImmutableLog } from "@/modules/security";
import { created, handleApiError } from "@/modules/shared";
import { requireInternalServiceAuth } from "@/modules/shared/auth/internal-service-auth";
import { AppError } from "@/modules/shared/errors/app-error";
import { getCorrelationId } from "@/modules/shared/http/request";

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    const rawBody = await request.text();
    const internal = await requireInternalServiceAuth(request, rawBody);

    let body: {
      actorId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
      result?: string;
      payload?: unknown;
      nonce?: string;
    };

    try {
      body = JSON.parse(rawBody || "{}") as {
        actorId?: string;
        action?: string;
        entityType?: string;
        entityId?: string;
        result?: string;
        payload?: unknown;
        nonce?: string;
      };
    } catch {
      throw new AppError("Content-Type must be application/json", "INVALID_INPUT", undefined, 400);
    }

    if (!body.actorId) {
      throw new AppError("actorId is required", "INVALID_INPUT", undefined, 400);
    }

    if (!body.nonce) {
      throw new AppError("nonce is required", "INVALID_INPUT", undefined, 400);
    }

    const replay = await prisma.internalLogNonce.findUnique({
      where: { nonce: body.nonce },
      select: { nonce: true },
    });

    if (replay) {
      throw new AppError("Replay nonce detected", "UNAUTHORIZED", undefined, 401);
    }

    await prisma.internalLogNonce.create({
      data: {
        nonce: body.nonce,
        serviceId: internal.serviceId,
      },
    });

    const log = await createInternalImmutableLog(
      {
        action: body.action,
        entityType: body.entityType,
        entityId: body.entityId,
        result: body.result,
        payload: body.payload,
      },
      correlationId,
      {
        serviceId: internal.serviceId,
        actorId: body.actorId,
      },
    );

    return created(log, {});
  } catch (error) {
    return handleApiError(request, error);
  }
}
