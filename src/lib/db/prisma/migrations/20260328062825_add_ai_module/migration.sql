-- CreateEnum
CREATE TYPE "AIQuestionIntent" AS ENUM ('SUMMARIZE', 'COMPARE', 'FORECAST', 'ANOMALY_DETECT', 'CLARIFY', 'TREND_ANALYSIS');

-- CreateEnum
CREATE TYPE "AICitationSourceType" AS ENUM ('REPORT', 'LEDGER', 'TRANSACTION', 'BUDGET', 'CONTROL_LOG');

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "question" TEXT,
    "answer" TEXT,
    "tableData" JSONB,
    "citations" JSONB,
    "processingTimeMs" INTEGER,
    "llmModel" VARCHAR(50),
    "tokensUsed" INTEGER,
    "costEstimate" DECIMAL(10,6),
    "confidenceScore" DECIMAL(3,2),
    "dataSourcesHit" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIVectorEmbedding" (
    "id" TEXT NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "sourceId" TEXT,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIVectorEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIConversation_userId_createdAt_idx" ON "AIConversation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_role_idx" ON "AIMessage"("role");

-- CreateIndex
CREATE INDEX "AIVectorEmbedding_sourceType_idx" ON "AIVectorEmbedding"("sourceType");

-- CreateIndex
CREATE INDEX "AIVectorEmbedding_createdAt_idx" ON "AIVectorEmbedding"("createdAt");

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
