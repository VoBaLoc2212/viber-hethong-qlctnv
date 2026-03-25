import { describe, expect, it } from "vitest";

import { addMoney, calculateAvailable, compareMoney, isNegativeMoney, subtractMoney } from "./decimal";

describe("decimal finance utils", () => {
  it("adds money correctly", () => {
    expect(addMoney("100.25", "20.75")).toBe("121.00");
  });

  it("subtracts money correctly", () => {
    expect(subtractMoney("100.00", "20.50")).toBe("79.50");
  });

  it("calculates available amount from amount/reserved/used", () => {
    expect(calculateAvailable("100.00", "10.00", "25.25")).toBe("64.75");
  });

  it("compares money values", () => {
    expect(compareMoney("10.00", "10.00")).toBe(0);
    expect(compareMoney("10.01", "10.00")).toBe(1);
    expect(compareMoney("9.99", "10.00")).toBe(-1);
  });

  it("detects negative amounts", () => {
    expect(isNegativeMoney("-0.01")).toBe(true);
    expect(isNegativeMoney("0.00")).toBe(false);
  });
});
