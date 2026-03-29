import { describe, expect, it } from "vitest";

import { computeSettlement } from "./reimbursement-service";

describe("computeSettlement", () => {
  it("returns RETURN_TO_COMPANY when advance > actual", () => {
    const result = computeSettlement("5000000.00", "4000000.00");
    expect(result).toEqual({
      netAmount: "1000000.00",
      direction: "RETURN_TO_COMPANY",
    });
  });

  it("returns PAY_TO_EMPLOYEE when advance < actual", () => {
    const result = computeSettlement("5000000.00", "6200000.00");
    expect(result).toEqual({
      netAmount: "-1200000.00",
      direction: "PAY_TO_EMPLOYEE",
    });
  });

  it("returns NO_CHANGE when advance equals actual", () => {
    const result = computeSettlement("5000000.00", "5000000.00");
    expect(result).toEqual({
      netAmount: "0.00",
      direction: "NO_CHANGE",
    });
  });
});
