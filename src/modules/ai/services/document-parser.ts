import { createHash } from "node:crypto";

import { AppError } from "@/modules/shared/errors/app-error";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".docx"];
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getExt(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx).toLowerCase();
}

async function parseDocxBuffer(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

export async function parseKnowledgeFile(file: File): Promise<{
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  text: string;
}> {
  const fileName = file.name?.trim();
  if (!fileName) {
    throw new AppError("Tên file không hợp lệ", "INVALID_INPUT");
  }

  const ext = getExt(fileName);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new AppError("Chỉ hỗ trợ file .txt hoặc .docx", "INVALID_INPUT");
  }

  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new AppError("Kích thước file phải từ 1 byte đến 5MB", "INVALID_INPUT");
  }

  const mimeType = file.type?.trim() || (ext === ".txt" ? "text/plain" : DOCX_MIME);
  if (ext === ".docx" && mimeType !== DOCX_MIME) {
    throw new AppError("MIME type file .docx không hợp lệ", "INVALID_INPUT");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const rawText = ext === ".txt" ? buffer.toString("utf8") : await parseDocxBuffer(buffer);
  const text = normalizeWhitespace(rawText);

  if (!text) {
    throw new AppError("Không trích xuất được nội dung văn bản từ file", "UNPROCESSABLE_ENTITY");
  }

  return {
    fileName,
    mimeType,
    fileSize: file.size,
    sha256,
    text,
  };
}
