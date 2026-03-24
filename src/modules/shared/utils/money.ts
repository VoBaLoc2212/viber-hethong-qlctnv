export const MONEY_SCALE = 2;

export function toMoneyString(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(MONEY_SCALE);
}
