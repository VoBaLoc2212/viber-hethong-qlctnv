import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiIntent, AiResolution } from "../types";
import { handleAiChat } from "./chat-orchestrator";
import { resolveAiPolicy } from "./ai-policy";

const {
  ensureChatSessionMock,
  appendChatMessageMock,
  listRecentChatContextMock,
  resolveIntentMock,
  resolveByServiceMock,
  resolveByRagMock,
  resolveByText2SqlMock,
} = vi.hoisted(() => ({
  ensureChatSessionMock: vi.fn(),
  appendChatMessageMock: vi.fn(),
  listRecentChatContextMock: vi.fn(),
  resolveIntentMock: vi.fn(),
  resolveByServiceMock: vi.fn(),
  resolveByRagMock: vi.fn(),
  resolveByText2SqlMock: vi.fn(),
}));

vi.mock("../repositories/chat-history-repo", () => ({
  ensureChatSession: ensureChatSessionMock,
  appendChatMessage: appendChatMessageMock,
  listRecentChatContext: listRecentChatContextMock,
}));

vi.mock("./intent-router", () => ({
  resolveIntent: resolveIntentMock,
  isLikelyServiceDataQuestion: vi.fn(() => true),
}));

vi.mock("./service-adapter", () => ({
  resolveByService: resolveByServiceMock,
}));

vi.mock("./rag-service", () => ({
  resolveByRag: resolveByRagMock,
}));

vi.mock("./text2sql-service", () => ({
  resolveByText2Sql: resolveByText2SqlMock,
}));

function buildInput(message: string) {
  return {
    auth: {
      userId: "u1",
      role: "MANAGER" as const,
      email: "manager@example.com",
    },
    request: {
      sessionId: "s1",
      message,
    },
    correlationId: "c1",
  };
}

describe("chat-orchestrator routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    ensureChatSessionMock.mockResolvedValue("s1");
    listRecentChatContextMock.mockResolvedValue([]);
    appendChatMessageMock.mockResolvedValue(undefined);
  });

  it("keeps SERVICE result when service resolver succeeds", async () => {
    resolveIntentMock.mockResolvedValue("QUERY" as AiIntent);
    resolveByServiceMock.mockResolvedValue({
      intent: "QUERY",
      routeUsed: "SERVICE",
      rawAnswer: "service answer",
      citations: [{ source: "service", snippet: "kpi" }],
      suggestedActions: ["x"],
    } satisfies AiResolution);

    const result = await handleAiChat(buildInput("Tổng ngân sách hiện tại"));
    const policy = resolveAiPolicy("Tổng ngân sách hiện tại", "QUERY", "MANAGER");

    expect(result.routeUsed).toBe("SERVICE");
    expect(result.answer).toBe("service answer");
    expect(result.dataDomain).toBe(policy.dataDomain);
    expect(result.policyKey).toBe(policy.policyKey);
    expect(result.scopeApplied).toBe(policy.scopeApplied);
    expect(resolveByRagMock).not.toHaveBeenCalled();
    expect(resolveByText2SqlMock).not.toHaveBeenCalled();
  });

  it("keeps SERVICE result for quantity budget question", async () => {
    resolveIntentMock.mockResolvedValue("QUERY" as AiIntent);
    resolveByServiceMock.mockResolvedValue({
      intent: "QUERY",
      routeUsed: "SERVICE",
      rawAnswer: "Có 2 ngân sách phù hợp.",
      citations: [{ source: "budget-service", snippet: "budget count" }],
      relatedData: { budgetCount: 2, departmentCount: 2 },
    } satisfies AiResolution);

    const result = await handleAiChat(buildInput("Có bao nhiêu ngân sách phòng ban?"));

    expect(result.routeUsed).toBe("SERVICE");
    expect(result.answer).toContain("Có 2 ngân sách phù hợp");
    expect(resolveByRagMock).not.toHaveBeenCalled();
    expect(resolveByText2SqlMock).not.toHaveBeenCalled();
  });

  it("uses RAG for GUIDANCE when service does not resolve", async () => {
    resolveIntentMock.mockResolvedValue("GUIDANCE" as AiIntent);
    resolveByServiceMock.mockResolvedValue(null);
    resolveByRagMock.mockResolvedValue({
      answer: "process answer",
      citations: [{ source: "docs/mock_quy_trinh_phe_duyet_chi_phi.txt", snippet: "Bước 1" }],
    });

    const result = await handleAiChat(buildInput("Quy trình phê duyệt chi phí"));

    expect(result.routeUsed).toBe("RAG");
    expect(result.answer).toBe("process answer");
    expect(resolveByText2SqlMock).not.toHaveBeenCalled();
  });

  it("keeps SERVICE for capability question instead of forcing RAG", async () => {
    resolveIntentMock.mockResolvedValue("GUIDANCE" as AiIntent);
    resolveByServiceMock.mockResolvedValue({
      intent: "GUIDANCE",
      routeUsed: "SERVICE",
      rawAnswer: "Vai trò hiện tại của bạn là MANAGER...",
      citations: [{ source: "rbac-policy", snippet: "capability-summary-manager" }],
    } satisfies AiResolution);

    const result = await handleAiChat(buildInput("Tôi có những quyền nào và bạn có thể làm gì?"));

    expect(result.routeUsed).toBe("SERVICE");
    expect(resolveByRagMock).not.toHaveBeenCalled();
  });

  it("falls back to TEXT2SQL when service misses and RAG looks insufficient", async () => {
    resolveIntentMock.mockResolvedValue("QUERY" as AiIntent);
    resolveByServiceMock.mockResolvedValue(null);
    resolveByRagMock.mockResolvedValue({
      answer: "Hiện chưa đủ nguồn, vào trang help để xem hướng dẫn",
      citations: [{ source: "docs/context.md", snippet: "fallback" }],
    });
    resolveByText2SqlMock.mockResolvedValue({
      answer: "Tổng chi hiện tại là 123 VND",
      citations: [{ source: "text2sql", snippet: "SELECT" }],
      relatedData: { rows: [{ totalSpent: 123 }] },
    });

    const result = await handleAiChat(buildInput("Tổng chi tháng này là bao nhiêu?"));

    expect(resolveByText2SqlMock).toHaveBeenCalledTimes(1);
    expect(result.routeUsed).toBe("TEXT2SQL");
    expect(result.answer).toBe("Tổng chi hiện tại là 123 VND");
  });

  it("prefers TEXT2SQL first for runtime data analysis question", async () => {
    resolveIntentMock.mockResolvedValue("ANALYSIS" as AiIntent);
    resolveByServiceMock.mockResolvedValue(null);
    resolveByText2SqlMock.mockResolvedValue({
      answer: "Đã truy vấn 10 dòng dữ liệu phù hợp.",
      citations: [{ source: "text2sql", snippet: "SELECT" }],
      relatedData: { sql: "SELECT * FROM Transaction LIMIT 10", rows: Array(10).fill({}) },
    });

    const result = await handleAiChat(buildInput("Báo cáo lịch sử chi theo ngày trong tháng này"));

    expect(result.routeUsed).toBe("TEXT2SQL");
    expect(resolveByRagMock).not.toHaveBeenCalled();
  });

  it("falls back to RAG when TEXT2SQL throws", async () => {
    resolveIntentMock.mockResolvedValue("QUERY" as AiIntent);
    resolveByServiceMock.mockResolvedValue(null);
    resolveByRagMock.mockResolvedValue({
      answer: "Hiện chưa đủ nguồn, vào trang help để xem hướng dẫn",
      citations: [{ source: "docs/context.md", snippet: "fallback" }],
    });
    resolveByText2SqlMock.mockRejectedValue(new Error("blocked"));

    const result = await handleAiChat(buildInput("Chi phí hiện tại của phòng Marketing?"));

    expect(resolveByText2SqlMock).toHaveBeenCalledTimes(1);
    expect(result.routeUsed).toBe("RAG");
    expect(result.answer).toContain("chưa đủ nguồn");
  });

  it("returns controlled RBAC message for data-runtime policy when retrieval paths are unavailable", async () => {
    resolveIntentMock.mockResolvedValue("QUERY" as AiIntent);
    resolveByServiceMock.mockResolvedValue(null);
    resolveByRagMock.mockResolvedValue({
      answer: "Hiện chưa đủ nguồn, vào trang help để xem hướng dẫn",
      citations: [{ source: "docs/context.md", snippet: "fallback" }],
    });
    resolveByText2SqlMock.mockRejectedValue(new Error("blocked"));

    const result = await handleAiChat(buildInput("Có bao nhiêu bản ghi nhật ký hệ thống gần nhất?"));

    expect(result.routeUsed).toBe("SERVICE");
    expect(result.answer).toContain("phạm vi quyền hiện tại");
    expect(result.policyKey).toBe("security-logs");
    expect(result.dataDomain).toBe("DATA_RUNTIME");
  });
});
