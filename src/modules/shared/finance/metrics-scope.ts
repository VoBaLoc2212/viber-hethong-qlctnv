export const EXCLUDED_FROM_GLOBAL_METRICS = ["REJECTED", "REVERSED"] as const;

export function globalMetricsScopeDescription() {
  return "INCOME: loại trừ REJECTED/REVERSED; EXPENSE: loại trừ EXECUTED/REJECTED/REVERSED";
}
