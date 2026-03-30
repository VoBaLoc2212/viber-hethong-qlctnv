import { describe, expect, it } from "vitest";

import { chunkText } from "./chunking";

describe("chunking", () => {
  it("preserves step line markers for process documents", () => {
    const input = [
      "Bước 1: Tạo yêu cầu chi",
      "Bước 2: Trưởng bộ phận phê duyệt",
      "Bước 3: Kế toán kiểm tra chứng từ",
    ].join("\n");

    const chunks = chunkText(input, 400, 50);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toContain("Bước 1: Tạo yêu cầu chi");
    expect(chunks[0]).toContain("\nBước 2: Trưởng bộ phận phê duyệt");
  });

  it("normalizes spaces but keeps line breaks", () => {
    const input = "Bước 1:   Tạo\t\t yêu cầu\r\nBước 2:   Phê duyệt";

    const [firstChunk] = chunkText(input, 400, 50);

    expect(firstChunk).toContain("Bước 1: Tạo yêu cầu");
    expect(firstChunk).toContain("\nBước 2: Phê duyệt");
  });
});
