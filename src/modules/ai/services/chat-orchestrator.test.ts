import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiIntent, AiResolution } from "../types";
import { handleAiChat } from "./chat-orchestrator";

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

    expect(result.routeUsed).toBe("SERVICE");
    expect(result.answer).toBe("service answer");
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
});
