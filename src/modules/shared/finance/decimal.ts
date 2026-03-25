import { AppError } from "@/modules/shared/errors/app-error";

const SCALE = 100;

function normalizeMoneyString(value: string): string {
  const trimmed = value.trim();
  if (!/^[-+]?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new AppError("Invalid money value", "INVALID_INPUT", { value });
  }

  return trimmed;
}

export function moneyToCents(value: string): number {
  const normalized = normalizeMoneyString(value);
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^[+-]/, "");
  const [integerPart, decimalPart = ""] = unsigned.split(".");
  const padded = (decimalPart + "00").slice(0, 2);

  const cents = Number(integerPart) * SCALE + Number(padded);
  const result = cents * sign;

  if (!Number.isSafeInteger(result)) {
    throw new AppError("Money value is out of safe integer range", "INVALID_INPUT", { value });
  }

  return result;
}

export function centsToMoney(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new AppError("Money cents must be safe integer", "INVALID_INPUT", { value });
  }

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const integerPart = Math.floor(abs / SCALE);
  const decimalPart = abs % SCALE;
  return `${sign}${integerPart.toString()}.${decimalPart.toString().padStart(2, "0")}`;
}

export function addMoney(a: string, b: string): string {
  return centsToMoney(moneyToCents(a) + moneyToCents(b));
}

export function subtractMoney(a: string, b: string): string {
  return centsToMoney(moneyToCents(a) - moneyToCents(b));
}

export function compareMoney(a: string, b: string): number {
  const diff = moneyToCents(a) - moneyToCents(b);
  if (diff === 0) return 0;
  return diff > 0 ? 1 : -1;
}

export function isNegativeMoney(value: string): boolean {
  return moneyToCents(value) < 0;
}

export function calculateAvailable(amount: string, reserved: string, used: string): string {
  return subtractMoney(subtractMoney(amount, reserved), used);
}
