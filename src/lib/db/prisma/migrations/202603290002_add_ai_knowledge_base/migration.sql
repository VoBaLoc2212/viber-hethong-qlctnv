DO $$ BEGIN
  CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'PROCESSING',
  "errorMessage" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "charCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocument_sha256_key" ON "KnowledgeDocument"("sha256");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_status_createdAt_idx" ON "KnowledgeDocument"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_uploadedById_createdAt_idx" ON "KnowledgeDocument"("uploadedById", "createdAt");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_chunkIndex_idx" ON "KnowledgeChunk"("documentId", "chunkIndex");

DO $$ BEGIN
  ALTER TABLE "KnowledgeDocument"
    ADD CONSTRAINT "KnowledgeDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
