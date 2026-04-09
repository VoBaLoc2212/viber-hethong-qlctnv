import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  searchKnowledgeChunksMock,
  getKnowledgeCorpusVersionMock,
  generateWithChatEndpointMock,
  getRagCacheMock,
  setRagCacheMock,
  readFileMock,
} = vi.hoisted(() => ({
  searchKnowledgeChunksMock: vi.fn(),
  getKnowledgeCorpusVersionMock: vi.fn(),
  generateWithChatEndpointMock: vi.fn(),
  getRagCacheMock: vi.fn(),
  setRagCacheMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock("../repositories/knowledge-repo", () => ({
  searchKnowledgeChunks: searchKnowledgeChunksMock,
  getKnowledgeCorpusVersion: getKnowledgeCorpusVersionMock,
}));

vi.mock("./openai-chat-client", () => ({
  generateWithChatEndpoint: generateWithChatEndpointMock,
}));

vi.mock("./memory-service", () => ({
  getRagCache: getRagCacheMock,
  setRagCache: setRagCacheMock,
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

import { resolveByRag } from "./rag-service";

describe("rag-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKnowledgeCorpusVersionMock.mockResolvedValue("1-100");
    getRagCacheMock.mockResolvedValue(null);
    setRagCacheMock.mockResolvedValue(undefined);
    searchKnowledgeChunksMock.mockResolvedValue([]);
    generateWithChatEndpointMock.mockResolvedValue(null);
    readFileMock.mockRejectedValue(new Error("not found"));
  });

  it("returns cached response when available", async () => {
    getRagCacheMock.mockResolvedValue({
      answer: "cached answer",
      citations: [{ source: "cached", snippet: "cached" }],
    });

    const result = await resolveByRag("quy trình phê duyệt chi phí", {
      userId: "u1",
      role: "MANAGER",
      email: "m@example.com",
    });

    expect(result.answer).toBe("cached answer");
    expect(searchKnowledgeChunksMock).not.toHaveBeenCalled();
    expect(setRagCacheMock).not.toHaveBeenCalled();
  });

  it("prioritizes uploaded knowledge citations when chunks are available", async () => {
    searchKnowledgeChunksMock.mockResolvedValue([
      {
        source: "Hat loto.docx",
        snippet: "chunk #1",
        content: "Nội dung từ tài liệu upload",
      },
    ]);
    generateWithChatEndpointMock.mockResolvedValue("Câu trả lời theo tài liệu upload");

    const result = await resolveByRag("Hát loto gồm những quan điểm nào?", {
      userId: "u1",
      role: "MANAGER",
      email: "m@example.com",
    });

    expect(result.answer).toBe("Câu trả lời theo tài liệu upload");
    expect(result.citations).toEqual([{ source: "Hat loto.docx", snippet: "chunk #1" }]);
    expect(result.citations.some((c) => c.source.startsWith("docs/"))).toBe(false);
  });

  it("uses static citations when no uploaded evidence exists", async () => {
    readFileMock.mockImplementation(async (path: string) => {
      if (path.includes("AI_RULES.md")) {
        return "Nội dung luật AI";
      }
      throw new Error("missing");
    });

    const result = await resolveByRag("Câu hỏi chung không có dữ liệu upload", {
      userId: "u1",
      role: "MANAGER",
      email: "m@example.com",
    });

    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0].source).toBe("docs/AI_RULES.md");
  });

  it("extracts flattened process steps from uploaded chunk", async () => {
    searchKnowledgeChunksMock.mockResolvedValue([
      {
        source: "quy_trinh.docx",
        snippet: "chunk #2",
        content: "Bước 1: Tạo yêu cầu Bước 2: Quản lý phê duyệt Bước 3: Kế toán kiểm tra",
      },
    ]);

    const result = await resolveByRag("Quy trình phê duyệt chi phí gồm gì?", {
      userId: "u1",
      role: "MANAGER",
      email: "m@example.com",
    });

    expect(result.answer).toContain("Bước 1: Tạo yêu cầu");
    expect(result.answer).toContain("Bước 2: Quản lý phê duyệt");
    expect(result.citations[0].source).toBe("quy_trinh.docx");
  });

  it("returns entity-focused answer for manager question", async () => {
    searchKnowledgeChunksMock.mockResolvedValue([
      {
        source: "mock_quy_trinh_phe_duyet_chi_phi.txt",
        snippet: "chunk #0",
        content: "Bước 3: Phê duyệt cấp quản lý\n- MANAGER xem xét lý do chi tiêu.\n- Có thể APPROVE hoặc REJECT.",
      },
    ]);

    const result = await resolveByRag("Trong quy trình, MANAGER làm gì?", {
      userId: "u1",
      role: "MANAGER",
      email: "m@example.com",
    });

    expect(result.answer).toContain("MANAGER xem xét lý do chi tiêu");
    expect(result.answer).not.toContain("Bước 1");
  });

  it("returns evidence-focused answer for settlement documents", async () => {
    searchKnowledgeChunksMock.mockResolvedValue([
      {
        source: "mock_nghiep_vu_hoan_ung_cong_tac.txt",
        snippet: "chunk #0",
        content: "II. Bộ chứng từ bắt buộc\n- Quyết định cử đi công tác.\n- Vé tàu/xe/máy bay hoặc hóa đơn lưu trú.\n- Hóa đơn chi phí phát sinh hợp lệ.",
      },
    ]);

    const result = await resolveByRag("Bộ chứng từ bắt buộc khi hoàn ứng công tác phí gồm gì?", {
      userId: "u1",
      role: "MANAGER",
      email: "m@example.com",
    });

    expect(result.answer).toContain("Bộ chứng từ bắt buộc");
    expect(result.answer).toContain("hóa đơn");
  });
});
