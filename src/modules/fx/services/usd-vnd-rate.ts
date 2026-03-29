import type { Prisma } from "@prisma/client";

import { AppError } from "@/modules/shared";

import type { ConvertedAmount } from "../types";


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

async function resolveUsdVndRate(
  tx: Prisma.TransactionClient,
  transactionDate: Date,
): Promise<{ rate: string; source: string; fetchedAt: Date; rateDate: Date }> {
  const rateDate = toRateDate(transactionDate);

  const existing = await tx.fxRate.findFirst({
    where: {
      fromCurrency: "USD",
      toCurrency: "VND",
      rateDate,
    },
    orderBy: { fetchedAt: "desc" },
  });

  if (existing) {
    return {
      rate: existing.rate.toFixed(6),
      source: existing.source,
      fetchedAt: existing.fetchedAt,
      rateDate,
    };
  }

  throw new AppError("USD/VND rate is unavailable for the transaction date", "UNPROCESSABLE_ENTITY", {
    rateDate: rateDate.toISOString(),
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
