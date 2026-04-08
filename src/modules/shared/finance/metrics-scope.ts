export const EXCLUDED_FROM_GLOBAL_METRICS = ["REJECTED", "REVERSED"] as const;

export function globalMetricsScopeDescription() {
  return "Loại trừ giao dịch REJECTED/REVERSED";
}
