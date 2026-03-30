import { prisma } from "@/lib/db/prisma/client";
import { AppError } from "@/modules/shared/errors/app-error";

export type KnowledgeDocumentSummary = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  errorMessage: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
};

type KnowledgeDb = {
  knowledgeDocument?: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    findFirst: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    count: (args: any) => Promise<number>;
  };
  knowledgeChunk?: {
    createMany: (args: any) => Promise<any>;
    deleteMany: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
};

function delegates() {
  const db = prisma as unknown as KnowledgeDb;

  if (!db.knowledgeDocument || !db.knowledgeChunk) {
    throw new AppError(
      "Knowledge base Prisma delegates are unavailable. Run Prisma migration and generate client.",
      "INTERNAL_SERVER_ERROR",
    );
  }

  return {
    knowledgeDocument: db.knowledgeDocument,
    knowledgeChunk: db.knowledgeChunk,
  };
}

function toSummary(row: {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: "PROCESSING" | "READY" | "FAILED" | "ARCHIVED";
  errorMessage: string | null;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeDocumentSummary {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    status: row.status,
    errorMessage: row.errorMessage,
    uploadedById: row.uploadedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listKnowledgeDocuments(limit = 50): Promise<KnowledgeDocumentSummary[]> {
  const db = delegates();

  const rows = await db.knowledgeDocument.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(1, Math.min(limit, 200)),
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      errorMessage: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map(toSummary);
}

export async function createKnowledgeDocument(input: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  uploadedById: string;
}): Promise<KnowledgeDocumentSummary> {
  const db = delegates();

  const existing = await db.knowledgeDocument.findFirst({
    where: { sha256: input.sha256, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      errorMessage: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (existing) {
    return toSummary(existing);
  }

  const created = await db.knowledgeDocument.create({
    data: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      sha256: input.sha256,
      status: "PROCESSING",
      uploadedById: input.uploadedById,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      errorMessage: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toSummary(created);
}

export async function markKnowledgeDocumentReady(documentId: string, chunks: string[]): Promise<KnowledgeDocumentSummary> {
  const db = delegates();

  const existing = await db.knowledgeDocument.findFirst({
    where: { id: documentId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("Knowledge document not found", "NOT_FOUND");
  }

  await db.knowledgeChunk.deleteMany({ where: { documentId } });

  if (chunks.length > 0) {
    await db.knowledgeChunk.createMany({
      data: chunks.map((content, index) => ({
        documentId,
        chunkIndex: index,
        content,
        charCount: content.length,
      })),
    });
  }

  const updated = await db.knowledgeDocument.update({
    where: { id: documentId },
    data: {
      status: "READY",
      errorMessage: null,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      errorMessage: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toSummary(updated);
}

export async function markKnowledgeDocumentFailed(documentId: string, message: string): Promise<void> {
  const db = delegates();

  await db.knowledgeDocument.update({
    where: { id: documentId },
    data: {
      status: "FAILED",
      errorMessage: message.slice(0, 500),
    },
  });
}

export async function archiveKnowledgeDocument(documentId: string): Promise<{ id: string; status: "ARCHIVED" }> {
  const db = delegates();

  const existing = await db.knowledgeDocument.findFirst({
    where: { id: documentId, status: { not: "ARCHIVED" } },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("Knowledge document not found", "NOT_FOUND");
  }

  await db.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: "ARCHIVED" },
  });

  return { id: documentId, status: "ARCHIVED" };
}

export async function getKnowledgeCorpusVersion(): Promise<string> {
  const db = delegates();

  const latest = await db.knowledgeDocument.findFirst({
    where: { status: "READY" },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  const count = await db.knowledgeDocument.count({ where: { status: "READY" } });
  const ts = latest?.updatedAt?.getTime() ?? 0;

  return `${count}-${ts}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function scoreChunk(content: string, keywords: string[], normalizedKeywords: string[]) {
  const lower = content.toLowerCase();
  const normalized = normalizeSearchText(content);
  const directScore = keywords.reduce((acc, token) => (lower.includes(token) ? acc + 1 : acc), 0);
  const normalizedScore = normalizedKeywords.reduce((acc, token) => (normalized.includes(token) ? acc + 1 : acc), 0);
  return directScore + normalizedScore;
}

export async function searchKnowledgeChunks(
  query: string,
  limit = 8,
  options?: { minScore?: number },
): Promise<Array<{ source: string; snippet: string; content: string }>> {
  const db = delegates();
  const safeLimit = Math.max(1, Math.min(limit, 12));
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);
  const normalizedKeywords = normalizeSearchText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);

  const where = keywords.length
    ? {
        document: { is: { status: "READY" } },
        OR: keywords.map((token) => ({ content: { contains: token, mode: "insensitive" as const } })),
      }
    : {
        document: { is: { status: "READY" } },
      };

  let rows = await db.knowledgeChunk.findMany({
    where,
    take: Math.max(1, Math.min(safeLimit * 4, 64)),
    orderBy: [{ createdAt: "desc" }],
    select: {
      content: true,
      chunkIndex: true,
      document: {
        select: {
          fileName: true,
        },
      },
    },
  });

  const scoredPrimary = rows.map((row) => ({
    score: scoreChunk(row.content, keywords, normalizedKeywords),
    source: row.document.fileName,
    snippet: `chunk #${row.chunkIndex}`,
    content: row.content,
  }));

  const hasStrongPrimary = scoredPrimary.some((row) => row.score > 0);

  if (!hasStrongPrimary) {
    rows = await db.knowledgeChunk.findMany({
      where: { document: { is: { status: "READY" } } },
      take: Math.max(16, Math.min(safeLimit * 8, 80)),
      orderBy: [{ createdAt: "desc" }],
      select: {
        content: true,
        chunkIndex: true,
        document: {
          select: {
            fileName: true,
          },
        },
      },
    });
  }

  const scored = rows.map((row) => ({
    score: scoreChunk(row.content, keywords, normalizedKeywords),
    source: row.document.fileName,
    snippet: `chunk #${row.chunkIndex}`,
    content: row.content,
  }));

  const topScore = scored.reduce((max, row) => (row.score > max ? row.score : max), 0);
  if (topScore <= 0) {
    return [];
  }

  const requestedMinScore = Math.max(1, options?.minScore ?? 1);
  const dynamicMinScore = Math.max(requestedMinScore, Math.floor(topScore * 0.4));

  return scored
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score >= dynamicMinScore)
    .slice(0, safeLimit)
    .map(({ source, snippet, content }) => ({ source, snippet, content }));
}
