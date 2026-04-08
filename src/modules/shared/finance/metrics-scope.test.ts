import { describe, expect, it } from "vitest";

import { EXCLUDED_FROM_GLOBAL_METRICS, globalMetricsScopeDescription } from "./metrics-scope";

describe("global metrics scope", () => {
  it("keeps excluded statuses stable", () => {
    expect(EXCLUDED_FROM_GLOBAL_METRICS).toEqual(["REJECTED", "REVERSED"]);
  });

  it("provides readable rule description", () => {
    expect(globalMetricsScopeDescription()).toContain("REJECTED/REVERSED");
  });
});
