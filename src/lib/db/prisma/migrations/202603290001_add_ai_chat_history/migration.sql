DO $$ BEGIN
  CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiRoute" AS ENUM ('SERVICE', 'RAG', 'TEXT2SQL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ChatSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" "ChatRole" NOT NULL,
  "content" TEXT NOT NULL,
  "intent" TEXT,
  "routeUsed" "AiRoute",
  "citations" JSONB,
  "relatedData" JSONB,
  "suggestedActions" JSONB,
  "tokenUsage" JSONB,
  "latencyMs" INTEGER,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ChatSession"
    ADD CONSTRAINT "ChatSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage"
    ADD CONSTRAINT "ChatMessage_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ChatSession_lastMessageAt_idx" ON "ChatSession"("lastMessageAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_correlationId_idx" ON "ChatMessage"("correlationId");
