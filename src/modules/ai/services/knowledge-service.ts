import type { AuthContext } from "@/modules/shared";
import { requireRole, writeAuditLog } from "@/modules/shared";
import { AppError } from "@/modules/shared/errors/app-error";

import {
  archiveKnowledgeDocument,
  createKnowledgeDocument,
  listKnowledgeDocuments,
  markKnowledgeDocumentFailed,
  markKnowledgeDocumentReady,
} from "../repositories/knowledge-repo";
import type { KnowledgeDocumentSummary } from "../repositories/knowledge-repo";
import { chunkText } from "./chunking";
import { parseKnowledgeFile } from "./document-parser";

function assertFinanceAdmin(auth: AuthContext) {
  requireRole(auth, ["FINANCE_ADMIN"]);
}

export async function listKnowledgeDocumentsForAdmin(auth: AuthContext): Promise<KnowledgeDocumentSummary[]> {
  assertFinanceAdmin(auth);
  return listKnowledgeDocuments(100);
}

export async function ingestKnowledgeDocument(
  auth: AuthContext,
  file: File,
  correlationId: string,
): Promise<KnowledgeDocumentSummary> {
  assertFinanceAdmin(auth);

  const parsed = await parseKnowledgeFile(file);
  const created = await createKnowledgeDocument({
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    fileSize: parsed.fileSize,
    sha256: parsed.sha256,
    uploadedById: auth.userId,
  });

  if (created.status === "READY") {
    return created;
  }

  try {
    const chunks = chunkText(parsed.text, 1000, 180);
    if (chunks.length === 0) {
      throw new AppError("Không đủ nội dung để lập chỉ mục tài liệu", "UNPROCESSABLE_ENTITY");
    }

    const ready = await markKnowledgeDocumentReady(created.id, chunks);

    await writeAuditLog({
      actorId: auth.userId,
      action: "AI_KNOWLEDGE_UPLOAD",
      entityType: "KNOWLEDGE_DOCUMENT",
      entityId: ready.id,
      correlationId,
      payload: {
        fileName: ready.fileName,
        fileSize: ready.fileSize,
        chunks: chunks.length,
        mimeType: ready.mimeType,
      },
    });

    return ready;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể lập chỉ mục tài liệu";
    await markKnowledgeDocumentFailed(created.id, message);
    throw error;
  }
}

export async function archiveKnowledgeDocumentForAdmin(
  auth: AuthContext,
  id: string,
  correlationId: string,
): Promise<{ id: string; status: "ARCHIVED" }> {
  assertFinanceAdmin(auth);

  const archived = await archiveKnowledgeDocument(id);

  await writeAuditLog({
    actorId: auth.userId,
    action: "AI_KNOWLEDGE_ARCHIVE",
    entityType: "KNOWLEDGE_DOCUMENT",
    entityId: id,
    correlationId,
  });

  return archived;
}
