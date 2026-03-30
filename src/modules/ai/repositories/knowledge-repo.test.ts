import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    knowledgeDocument: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    knowledgeChunk: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/prisma/client", () => ({
  prisma: prismaMock,
}));

import { searchKnowledgeChunks } from "./knowledge-repo";

describe("knowledge-repo searchKnowledgeChunks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("ranks accented content for unaccented query via normalized scoring", async () => {
    prismaMock.knowledgeChunk.findMany
      .mockResolvedValueOnce([
        {
          content: "Quy trình phê duyệt chi phí cần 3 bước",
          chunkIndex: 1,
          document: { fileName: "quy-trinh.docx" },
        },
      ])
      .mockResolvedValueOnce([
        {
          content: "Quy trình phê duyệt chi phí cần 3 bước",
          chunkIndex: 1,
          document: { fileName: "quy-trinh.docx" },
        },
      ]);

    const rows = await searchKnowledgeChunks("quy trinh phe duyet chi phi", 5);

    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe("quy-trinh.docx");
    expect(rows[0].snippet).toBe("chunk #1");
  });

  it("falls back to broad candidate query when primary pass has zero score", async () => {
    prismaMock.knowledgeChunk.findMany
      .mockResolvedValueOnce([
        {
          content: "Nội dung không liên quan",
          chunkIndex: 1,
          document: { fileName: "a.txt" },
        },
      ])
      .mockResolvedValueOnce([
        {
          content: "Chi phí tháng này tăng do chiến dịch marketing",
          chunkIndex: 2,
          document: { fileName: "b.txt" },
        },
      ]);

    const rows = await searchKnowledgeChunks("chi phi thang nay", 3);

    expect(prismaMock.knowledgeChunk.findMany).toHaveBeenCalledTimes(2);
    expect(rows[0].source).toBe("b.txt");
  });

  it("returns empty list when all candidates are below min score threshold", async () => {
    prismaMock.knowledgeChunk.findMany
      .mockResolvedValueOnce([
        {
          content: "ngắn",
          chunkIndex: 1,
          document: { fileName: "weak.txt" },
        },
      ])
      .mockResolvedValueOnce([
        {
          content: "ngắn",
          chunkIndex: 1,
          document: { fileName: "weak.txt" },
        },
      ]);

    const rows = await searchKnowledgeChunks("chi phi", 8, { minScore: 2 });

    expect(rows).toEqual([]);
  });
});
