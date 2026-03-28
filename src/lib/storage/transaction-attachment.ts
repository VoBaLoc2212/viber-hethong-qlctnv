import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "@/modules/shared/errors/app-error";

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
].join(",");

function resolveUploadDirectory() {
  const cwd = process.cwd();

  if (existsSync(path.join(cwd, "src"))) {
    return path.join(cwd, "src", "public", "uploads", "transactions");
  }

  return path.join(cwd, "public", "uploads", "transactions");
}

const UPLOAD_DIRECTORY = resolveUploadDirectory();

type UploadedAttachment = {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string | null;
};

function readMaxFileSizeBytes() {
  const raw = process.env.TRANSACTION_ATTACHMENT_MAX_FILE_SIZE_BYTES;
  if (!raw) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  return Math.floor(parsed);
}

function readAllowedMimeTypes() {
  const raw = process.env.TRANSACTION_ATTACHMENT_ALLOWED_MIME_TYPES ?? DEFAULT_ALLOWED_MIME_TYPES;
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function sanitizeFilename(originalName: string) {
  const base = path.basename(originalName || "attachment");
  const normalized = base
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);

  return normalized || "attachment";
}

function buildStoredFilename(safeName: string) {
  const extension = path.extname(safeName).toLowerCase();
  return `${Date.now()}-${randomUUID()}${extension}`;
}

export async function saveTransactionAttachment(file: File): Promise<UploadedAttachment> {
  if (!file) {
    throw new AppError("file is required", "INVALID_INPUT");
  }

  if (file.size <= 0) {
    throw new AppError("file is empty", "INVALID_INPUT");
  }

  const maxFileSizeBytes = readMaxFileSizeBytes();
  if (file.size > maxFileSizeBytes) {
    throw new AppError(`File exceeds max size ${maxFileSizeBytes} bytes`, "INVALID_INPUT");
  }

  const mimeType = (file.type || "").toLowerCase();
  const allowedMimeTypes = readAllowedMimeTypes();
  if (mimeType && allowedMimeTypes.size > 0 && !allowedMimeTypes.has(mimeType)) {
    throw new AppError("Unsupported file type", "INVALID_INPUT", { mimeType });
  }

  const safeName = sanitizeFilename(file.name);
  const storedName = buildStoredFilename(safeName);
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(UPLOAD_DIRECTORY, { recursive: true });
  await writeFile(path.join(UPLOAD_DIRECTORY, storedName), bytes);

  return {
    fileName: safeName,
    fileUrl: `/uploads/transactions/${storedName}`,
    fileSize: file.size,
    mimeType: mimeType || null,
  };
}
