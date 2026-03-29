import type { Prisma } from "@prisma/client";

import { AppError } from "@/modules/shared";

import type { ConvertedAmount } from "../types";

const FX_FETCH_TIMEOUT_MS = 1500;
const FX_STALE_FALLBACK_DAYS = 3;
const PRIMARY_SOURCE = "WEB_OPEN_ER_API";
const SECONDARY_SOURCE = "WEB_EXCHANGERATE_HOST";
const PRIMARY_URL = "https://open.er-api.com/v6/latest/USD";
const SECONDARY_URL = "https://api.exchangerate.host/latest?base=USD&symbols=VND";

function toRateDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizePositiveDecimal(value: string, scale: number, field: string): string {
  const trimmed = value.trim();
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`);
  if (!pattern.test(trimmed)) {
    throw new AppError(`${field} is invalid`, "INVALID_INPUT");
  }

  if (Number(trimmed) <= 0) {
    throw new AppError(`${field} must be greater than 0`, "INVALID_INPUT");
  }

  return trimmed;
}

function multiplyUsdByRateToVnd(fxAmount: string, rate: string): string {
  const value = Number(fxAmount) * Number(rate);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError("Unable to convert USD amount to VND", "UNPROCESSABLE_ENTITY");
  }

  return value.toFixed(2);
}

function normalizeProviderRate(rawRate: unknown): string {
  const rate = typeof rawRate === "number" ? rawRate : Number(rawRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AppError("Provider returned invalid USD/VND rate", "UNPROCESSABLE_ENTITY");
  }

  return rate.toFixed(6);
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new AppError(`FX provider returned HTTP ${response.status}`, "UNPROCESSABLE_ENTITY");
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Failed to fetch FX rate from provider", "UNPROCESSABLE_ENTITY");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchUsdVndRateFromWeb(): Promise<{ rate: string; source: string; fetchedAt: Date }> {
  try {
    const primaryPayload = await fetchJsonWithTimeout(PRIMARY_URL) as {
      rates?: { VND?: number };
    };

    return {
      rate: normalizeProviderRate(primaryPayload?.rates?.VND),
      source: PRIMARY_SOURCE,
      fetchedAt: new Date(),
    };
  } catch {
    const secondaryPayload = await fetchJsonWithTimeout(SECONDARY_URL) as {
      rates?: { VND?: number };
    };

    return {
      rate: normalizeProviderRate(secondaryPayload?.rates?.VND),
      source: SECONDARY_SOURCE,
      fetchedAt: new Date(),
    };
  }
}

async function loadCachedRateForDate(
  tx: Prisma.TransactionClient,
  rateDate: Date,
): Promise<{ rate: string; source: string; fetchedAt: Date; rateDate: Date } | null> {
  const existing = await tx.fxRate.findFirst({
    where: {
      fromCurrency: "USD",
      toCurrency: "VND",
      rateDate,
    },
    orderBy: { fetchedAt: "desc" },
  });

  if (!existing) return null;

  return {
    rate: existing.rate.toFixed(6),
    source: existing.source,
    fetchedAt: existing.fetchedAt,
    rateDate,
  };
}

async function loadFallbackCachedRate(
  tx: Prisma.TransactionClient,
  rateDate: Date,
): Promise<{ rate: string; source: string; fetchedAt: Date; rateDate: Date } | null> {
  const minDate = new Date(rateDate);
  minDate.setUTCDate(minDate.getUTCDate() - FX_STALE_FALLBACK_DAYS);

  const fallback = await tx.fxRate.findFirst({
    where: {
      fromCurrency: "USD",
      toCurrency: "VND",
      rateDate: {
        gte: minDate,
        lte: rateDate,
      },
    },
    orderBy: [{ rateDate: "desc" }, { fetchedAt: "desc" }],
  });

  if (!fallback) return null;

  return {
    rate: fallback.rate.toFixed(6),
    source: fallback.source,
    fetchedAt: fallback.fetchedAt,
    rateDate: fallback.rateDate,
  };
}

function isSameUtcDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function persistFetchedRate(
  tx: Prisma.TransactionClient,
  rateDate: Date,
  fetched: { rate: string; source: string; fetchedAt: Date },
): Promise<{ rate: string; source: string; fetchedAt: Date; rateDate: Date }> {
  try {
    const created = await tx.fxRate.create({
      data: {
        fromCurrency: "USD",
        toCurrency: "VND",
        rateDate,
        rate: fetched.rate,
        source: fetched.source,
        fetchedAt: fetched.fetchedAt,
      },
    });

    return {
      rate: created.rate.toFixed(6),
      source: created.source,
      fetchedAt: created.fetchedAt,
      rateDate: created.rateDate,
    };
  } catch {
    const raced = await loadCachedRateForDate(tx, rateDate);
    if (raced) return raced;
    throw new AppError("Unable to persist fetched FX rate", "UNPROCESSABLE_ENTITY");
  }
}

async function resolveUsdVndRate(
  tx: Prisma.TransactionClient,
  transactionDate: Date,
): Promise<{ rate: string; source: string; fetchedAt: Date; rateDate: Date }> {
  const rateDate = toRateDate(transactionDate);
  const todayRateDate = toRateDate(new Date());

  if (isSameUtcDate(rateDate, todayRateDate)) {
    try {
      const fetched = await fetchUsdVndRateFromWeb();
      return await persistFetchedRate(tx, rateDate, fetched);
    } catch {
      const cachedToday = await loadCachedRateForDate(tx, rateDate);
      if (cachedToday) return cachedToday;

      const fallback = await loadFallbackCachedRate(tx, rateDate);
      if (fallback) return fallback;

      throw new AppError("USD/VND rate is unavailable", "UNPROCESSABLE_ENTITY", {
        rateDate: rateDate.toISOString(),
        fallbackWindowDays: FX_STALE_FALLBACK_DAYS,
      });
    }
  }

  const cached = await loadCachedRateForDate(tx, rateDate);
  if (cached) {
    return cached;
  }

  const fallback = await loadFallbackCachedRate(tx, rateDate);
  if (fallback) {
    return fallback;
  }

  throw new AppError("USD/VND rate is unavailable for non-current transaction date", "UNPROCESSABLE_ENTITY", {
    rateDate: rateDate.toISOString(),
    fallbackWindowDays: FX_STALE_FALLBACK_DAYS,
  });
}

export async function convertUsdToVndByDate(
  tx: Prisma.TransactionClient,
  fxAmountInput: string,
  transactionDate: Date,
): Promise<ConvertedAmount> {
  const fxAmount = normalizePositiveDecimal(fxAmountInput, 2, "fxAmount");
  const rateSnapshot = await resolveUsdVndRate(tx, transactionDate);

  return {
    originalAmount: Number(fxAmount).toFixed(2),
    originalCurrency: "USD",
    convertedAmount: multiplyUsdByRateToVnd(fxAmount, rateSnapshot.rate),
    convertedCurrency: "VND",
    rate: rateSnapshot.rate,
    rateDate: rateSnapshot.rateDate.toISOString(),
    source: rateSnapshot.source,
    fetchedAt: rateSnapshot.fetchedAt.toISOString(),
  };
}
