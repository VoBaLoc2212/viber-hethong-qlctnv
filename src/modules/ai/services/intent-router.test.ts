import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateWithChatEndpointMock, getIntentCacheMock, setIntentCacheMock } = vi.hoisted(() => ({
  generateWithChatEndpointMock: vi.fn(),
  getIntentCacheMock: vi.fn(),
  setIntentCacheMock: vi.fn(),
}));

vi.mock("./openai-chat-client", () => ({
  generateWithChatEndpoint: generateWithChatEndpointMock,
}));

vi.mock("./memory-service", () => ({
  getIntentCache: getIntentCacheMock,
  setIntentCache: setIntentCacheMock,
}));

import { isLikelyServiceDataQuestion, normalizeIntent, resolveIntent, ruleBasedIntent } from "./intent-router";

describe("intent-router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntentCacheMock.mockResolvedValue(null);
    setIntentCacheMock.mockResolvedValue(undefined);
    generateWithChatEndpointMock.mockResolvedValue(null);
  });

  it("detects GREETING intent", () => {
    expect(ruleBasedIntent("hello")).toBe("GREETING");
    expect(ruleBasedIntent("xin chào")).toBe("GREETING");
  });

  it("detects GUIDANCE intent from workflow questions", () => {
    expect(ruleBasedIntent("Làm sao để tạo yêu cầu chi?")).toBe("GUIDANCE");
    expect(ruleBasedIntent("Quy trình phê duyệt chi phí")).toBe("GUIDANCE");
  });

  it("keeps KPI summary questions in QUERY instead of GUIDANCE", () => {
    expect(ruleBasedIntent("Tổng ngân sách hiện tại là bao nhiêu?")).toBe("QUERY");
    expect(ruleBasedIntent("Tổng chi tổng thu số dư hiện tại")).toBe("QUERY");
  });

  it("keeps quantity budget questions in QUERY and service-data scope", () => {
    expect(ruleBasedIntent("Có bao nhiêu ngân sách phòng ban?")).toBe("QUERY");
    expect(isLikelyServiceDataQuestion("Có bao nhiêu ngân sách phòng ban?")).toBe(true);
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

  it("keeps mixed greeting + data question in QUERY", () => {
    expect(ruleBasedIntent("Xin chào, tổng chi tháng này là bao nhiêu?")).toBe("QUERY");
  });

  it("does not classify generic top keyword as ANALYSIS", () => {
    expect(ruleBasedIntent("top cái gì vậy")).toBe("QUERY");
    expect(ruleBasedIntent("top danh mục chi phí quý này")).toBe("ANALYSIS");
  });

  it("classifies hard-stop timeline question as FORECAST", () => {
    expect(ruleBasedIntent("Nếu giữ tốc độ chi hiện tại, khi nào ngân sách IT chạm hard stop?")).toBe("FORECAST");
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
    expect(isLikelyServiceDataQuestion("ngan sach marketing")).toBe(true);
    expect(isLikelyServiceDataQuestion("nga sach marketing")).toBe(true);
    expect(isLikelyServiceDataQuestion("marketing budget")).toBe(true);
  });

  it("detects non-service general questions", () => {
    expect(isLikelyServiceDataQuestion("Bạn là ai?")).toBe(false);
    expect(isLikelyServiceDataQuestion("Kể một câu chuyện vui")).toBe(false);
  });

  it("classifies provided UAT prompts consistently", () => {
    const matrix = [
      { q: "Chi phí tháng 1 của phòng Marketing?", intent: "QUERY", serviceData: true },
      { q: "5 giao dịch EXPENSE gần nhất của tôi?", intent: "QUERY", serviceData: true },
      { q: "So sánh chi phí Q1 vs Q2 theo phòng ban.", intent: "ANALYSIS", serviceData: true },
      { q: "Vì sao chi phí tháng này tăng so với tháng trước?", intent: "ANALYSIS", serviceData: true },
      { q: "Dựa trên recurring transactions, dự báo chi phí tháng tới theo tuần.", intent: "FORECAST", serviceData: true },
      { q: "Nếu giữ tốc độ chi hiện tại, khi nào ngân sách IT chạm hard stop?", intent: "FORECAST", serviceData: true },
      { q: "Phòng nào sắp vượt ngân sách?", intent: "ALERT", serviceData: true },
      { q: "Có approval nào bị treo quá 3 ngày không?", intent: "ALERT", serviceData: true },
      { q: "Làm sao để tạo yêu cầu chi?", intent: "GUIDANCE", serviceData: false },
      { q: "Khi bật hard stop thì điều gì xảy ra?", intent: "GUIDANCE", serviceData: false },
      { q: "Tổng chi tổng thu số dư và tổng ngân sách hiện tại", intent: "QUERY", serviceData: true },
      { q: "Tổng ngân sách hiện tại", intent: "QUERY", serviceData: true },
      { q: "bạn là ai", intent: "QUERY", serviceData: false },
      { q: "Quy trình phê duyệt chi phí", intent: "GUIDANCE", serviceData: true },
    ] as const;

    for (const row of matrix) {
      expect(ruleBasedIntent(row.q)).toBe(row.intent);
      expect(isLikelyServiceDataQuestion(row.q)).toBe(row.serviceData);
    }
  });

  it("respects cache and skips model call", async () => {
    getIntentCacheMock.mockResolvedValue({ intent: "ALERT" });

    const result = await resolveIntent("u1", "Phòng nào sắp vượt ngân sách?");

    expect(result).toBe("ALERT");
    expect(generateWithChatEndpointMock).not.toHaveBeenCalled();
    expect(setIntentCacheMock).not.toHaveBeenCalled();
  });

  it("uses model for QUERY and stores resolved intent", async () => {
    generateWithChatEndpointMock.mockResolvedValue("ANALYSIS");

    const result = await resolveIntent("u1", "chi phí tăng vì sao");

    expect(result).toBe("ANALYSIS");
    expect(setIntentCacheMock).toHaveBeenCalledWith("u1", "chi phí tăng vì sao", "ANALYSIS");
  });

  it("allows model override for ambiguous non-QUERY pair", async () => {
    generateWithChatEndpointMock.mockResolvedValue("ANALYSIS");

    const message = "quy trình phê duyệt có điểm nghẽn ở đâu";
    const result = await resolveIntent("u1", message);

    expect(ruleBasedIntent(message)).toBe("GUIDANCE");
    expect(result).toBe("ANALYSIS");
  });

  it("keeps ruled intent for non-ambiguous non-QUERY mismatch", async () => {
    generateWithChatEndpointMock.mockResolvedValue("QUERY");

    const result = await resolveIntent("u1", "Phòng nào sắp vượt ngân sách?");

    expect(result).toBe("ALERT");
  });
});
