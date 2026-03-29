import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma/client";
import { assertNotAuditorForMutation, type AuthContext, requireRole, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

function assertFxRateDelegate() {
  const delegate = (prisma as unknown as { fxRate?: typeof prisma.fxRate }).fxRate;
  if (!delegate) {
    throw new AppError(
      "FxRate Prisma delegate is unavailable. Regenerate Prisma Client with src/lib/db/prisma/schema.prisma.",
      "INTERNAL_ERROR",
    );
  }

  return delegate;
}

import type { FxRate } from "../types";

type FxRateFilter = {
  page: number;
  limit: number;
  fromCurrency?: string;
  toCurrency?: string;
  source?: string;
  rateDateFrom?: string;
  rateDateTo?: string;
  q?: string;
};

type CreateFxRatePayload = {
  fromCurrency?: string;
  toCurrency?: string;
  rateDate?: string;
  rate?: string;
  source?: string;
};

type UpdateFxRatePayload = {
  rate?: string;
  source?: string;
  rateDate?: string;
};

function toRateDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeCurrency(value: string | undefined, field: string): "USD" | "VND" {
  if (!value) throw new AppError(`${field} is required`, "INVALID_INPUT");
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError(`${field} is invalid`, "INVALID_INPUT");
  }

  if (normalized !== "USD" && normalized !== "VND") {
    throw new AppError(`${field} is not supported`, "INVALID_INPUT");
  }

  return normalized;
}

function normalizeSource(value: string | undefined): string {
  const normalized = value?.trim().toUpperCase() || "MANUAL_ADMIN";
  if (!normalized) throw new AppError("source is required", "INVALID_INPUT");
  if (normalized.length > 64) throw new AppError("source is too long", "INVALID_INPUT");
  return normalized;
}

function normalizeRate(value: string | undefined): string {
  if (!value) throw new AppError("rate is required", "INVALID_INPUT");
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new AppError("rate is invalid", "INVALID_INPUT");
  }

  if (Number(trimmed) <= 0) {
    throw new AppError("rate must be greater than 0", "INVALID_INPUT");
  }

  return Number(trimmed).toFixed(6);
}

function normalizeRateDate(value: string | undefined, field = "rateDate"): Date {
  if (!value) throw new AppError(`${field} is required`, "INVALID_INPUT");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} is invalid`, "INVALID_INPUT");
  }

  return toRateDate(date);
}

function toFxRateView(row: {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rateDate: Date;
  rate: Prisma.Decimal;
  source: string;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): FxRate {
  return {
    id: row.id,
    fromCurrency: row.fromCurrency as "USD" | "VND",
    toCurrency: row.toCurrency as "USD" | "VND",
    rate: row.rate.toFixed(6),
    rateDate: row.rateDate.toISOString(),
    source: row.source,
    fetchedAt: row.fetchedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFxRates(auth: AuthContext, filter: FxRateFilter) {
  requireRole(auth, ["FINANCE_ADMIN"]);

  const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
  const limit = Number.isFinite(filter.limit) && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
  const skip = (page - 1) * limit;

  const keyword = filter.q?.trim();

  const where: Prisma.FxRateWhereInput = {
    fromCurrency: "USD",
    toCurrency: "VND",
    ...(filter.fromCurrency ? { fromCurrency: filter.fromCurrency.trim().toUpperCase() } : {}),
    ...(filter.toCurrency ? { toCurrency: filter.toCurrency.trim().toUpperCase() } : {}),
    ...(filter.source ? { source: { contains: filter.source.trim().toUpperCase(), mode: "insensitive" } } : {}),
    ...(filter.rateDateFrom || filter.rateDateTo
      ? {
          rateDate: {
            ...(filter.rateDateFrom ? { gte: normalizeRateDate(filter.rateDateFrom, "rateDateFrom") } : {}),
            ...(filter.rateDateTo ? { lte: normalizeRateDate(filter.rateDateTo, "rateDateTo") } : {}),
          },
        }
      : {}),
    ...(keyword
      ? {
          OR: [
            { fromCurrency: { contains: keyword.toUpperCase(), mode: "insensitive" } },
            { toCurrency: { contains: keyword.toUpperCase(), mode: "insensitive" } },
            { source: { contains: keyword.toUpperCase(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const fxRate = assertFxRateDelegate();

  const [total, rows] = await Promise.all([
    fxRate.count({ where }),
    fxRate.findMany({
      where,
      orderBy: [{ rateDate: "desc" }, { updatedAt: "desc" }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map(toFxRateView),
    meta: { total, page, limit },
  };
}

export async function createFxRate(auth: AuthContext, payload: CreateFxRatePayload, correlationId: string) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  const fromCurrency = normalizeCurrency(payload.fromCurrency, "fromCurrency");
  const toCurrency = normalizeCurrency(payload.toCurrency, "toCurrency");
  const rateDate = normalizeRateDate(payload.rateDate);
  const rate = normalizeRate(payload.rate);
  const source = normalizeSource(payload.source);

  if (fromCurrency !== "USD" || toCurrency !== "VND") {
    throw new AppError("Only USD to VND is supported", "UNPROCESSABLE_ENTITY");
  }

  const fxRate = assertFxRateDelegate();

  try {
    const created = await fxRate.create({
      data: {
        fromCurrency,
        toCurrency,
        rateDate,
        rate,
        source,
        fetchedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "FX_RATE_CREATE",
      entityType: "FX_RATE",
      entityId: created.id,
      correlationId,
      payload: {
        fromCurrency,
        toCurrency,
        rateDate: created.rateDate.toISOString(),
        rate,
        source,
      },
    });

    return toFxRateView(created);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new AppError("Fx rate for this day already exists", "CONFLICT");
    }

    throw error;
  }
}

export async function updateFxRateById(
  auth: AuthContext,
  id: string,
  payload: UpdateFxRatePayload,
  correlationId: string,
) {
  requireRole(auth, ["FINANCE_ADMIN"]);
  assertNotAuditorForMutation(auth);

  const fxRate = assertFxRateDelegate();

  const existing = await fxRate.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Fx rate not found", "NOT_FOUND");
  }

  const data: {
    rate?: string;
    source?: string;
    rateDate?: Date;
    fetchedAt?: Date;
  } = {};

  if (payload.rate !== undefined) data.rate = normalizeRate(payload.rate);
  if (payload.source !== undefined) data.source = normalizeSource(payload.source);
  if (payload.rateDate !== undefined) data.rateDate = normalizeRateDate(payload.rateDate);

  if (Object.keys(data).length === 0) {
    throw new AppError("No fields provided for update", "INVALID_INPUT");
  }

  data.fetchedAt = new Date();

  try {
    const updated = await fxRate.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actorId: auth.userId,
      action: "FX_RATE_UPDATE",
      entityType: "FX_RATE",
      entityId: updated.id,
      correlationId,
      payload: {
        changedFields: Object.keys(data),
      },
    });

    return toFxRateView(updated);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new AppError("Fx rate for this day already exists", "CONFLICT");
    }

    throw error;
  }
}
