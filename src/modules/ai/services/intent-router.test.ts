import { describe, expect, it } from "vitest";

import { isLikelyServiceDataQuestion, normalizeIntent, ruleBasedIntent } from "./intent-router";

describe("intent-router", () => {
  it("detects GREETING intent", () => {
    expect(ruleBasedIntent("hello")).toBe("GREETING");
    expect(ruleBasedIntent("xin chào")).toBe("GREETING");
  });

  it("detects GUIDANCE intent from workflow questions", () => {
    expect(ruleBasedIntent("Làm sao để tạo yêu cầu chi?")).toBe("GUIDANCE");
  });

  it("detects ALERT intent from warning questions", () => {
    expect(ruleBasedIntent("Phòng nào sắp vượt ngân sách?")).toBe("ALERT");
  });

  it("detects FORECAST intent from prediction questions", () => {
    expect(ruleBasedIntent("Dự báo chi phí tháng tới")).toBe("FORECAST");
  });

  it("detects ANALYSIS intent from compare questions", () => {
    expect(ruleBasedIntent("So sánh chi phí Q1 vs Q2")).toBe("ANALYSIS");
  });

  it("falls back to QUERY", () => {
    expect(ruleBasedIntent("Chi phí tháng 1 của phòng Marketing?")).toBe("QUERY");
  });

  it("normalizes valid model intent", () => {
    expect(normalizeIntent("  forecast ")).toBe("FORECAST");
    expect(normalizeIntent("greeting")).toBe("GREETING");
  });

  it("rejects unknown model intent", () => {
    expect(normalizeIntent("OTHER")).toBeNull();
  });

  it("detects service data questions", () => {
    expect(isLikelyServiceDataQuestion("Chi phí tháng 1 của phòng Marketing?")).toBe(true);
    expect(isLikelyServiceDataQuestion("Top danh mục chi phí quý này")).toBe(true);
  });

  it("detects non-service general questions", () => {
    expect(isLikelyServiceDataQuestion("Bạn là ai?")).toBe(false);
    expect(isLikelyServiceDataQuestion("Kể một câu chuyện vui")).toBe(false);
  });
});
