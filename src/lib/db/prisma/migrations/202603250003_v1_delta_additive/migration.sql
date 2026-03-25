-- v1 delta additive migration: recurring, attachments, splits, FX, reconciliation, approval enum compatibility

-- Create new enums (idempotent guards for existing DBs)
DO $$
BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'RECONCILED', 'EXCEPTION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Approval compatibility (keep old status text, add enum column)
ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "statusV2" "ApprovalStatus";
CREATE INDEX IF NOT EXISTS "Approval_approverId_statusV2_idx" ON "Approval"("approverId", "statusV2");

-- Recurring transaction source + FX fields for Transaction
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "recurringSourceId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxCurrency" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxAmount" DECIMAL(18,2);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxRate" DECIMAL(18,6);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "baseCurrency" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "baseAmount" DECIMAL(18,2);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxRateProvider" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fxRateFetchedAt" TIMESTAMP(3);

-- FX + reconciliation fields for LedgerEntry
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "fxCurrency" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "fxAmount" DECIMAL(18,2);
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "fxRate" DECIMAL(18,6);
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "baseCurrency" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "baseAmount" DECIMAL(18,2);
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "fxRateProvider" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "fxRateFetchedAt" TIMESTAMP(3);
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED';
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3);
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "reconciledById" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "reconciliationRef" TEXT;

-- New recurring template table
CREATE TABLE IF NOT EXISTS "RecurringTransaction" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "frequency" "RecurringFrequency" NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "budgetId" TEXT,
  "departmentId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

-- New transaction attachment table
CREATE TABLE IF NOT EXISTS "TransactionAttachment" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionAttachment_pkey" PRIMARY KEY ("id")
);

-- New transaction split table
CREATE TABLE IF NOT EXISTS "TransactionSplit" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "categoryCode" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionSplit_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Transaction_recurringSourceId_idx" ON "Transaction"("recurringSourceId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_reconciliationStatus_idx" ON "LedgerEntry"("reconciliationStatus");
CREATE INDEX IF NOT EXISTS "LedgerEntry_reconciledById_idx" ON "LedgerEntry"("reconciledById");
CREATE INDEX IF NOT EXISTS "RecurringTransaction_active_nextRunAt_idx" ON "RecurringTransaction"("active", "nextRunAt");
CREATE INDEX IF NOT EXISTS "RecurringTransaction_budgetId_idx" ON "RecurringTransaction"("budgetId");
CREATE INDEX IF NOT EXISTS "RecurringTransaction_departmentId_idx" ON "RecurringTransaction"("departmentId");
CREATE INDEX IF NOT EXISTS "TransactionAttachment_transactionId_createdAt_idx" ON "TransactionAttachment"("transactionId", "createdAt");
CREATE INDEX IF NOT EXISTS "TransactionAttachment_uploadedById_idx" ON "TransactionAttachment"("uploadedById");
CREATE INDEX IF NOT EXISTS "TransactionSplit_transactionId_idx" ON "TransactionSplit"("transactionId");

-- Foreign keys
DO $$
BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_recurringSourceId_fkey"
    FOREIGN KEY ("recurringSourceId") REFERENCES "RecurringTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "LedgerEntry"
    ADD CONSTRAINT "LedgerEntry_reconciledById_fkey"
    FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "RecurringTransaction"
    ADD CONSTRAINT "RecurringTransaction_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "RecurringTransaction"
    ADD CONSTRAINT "RecurringTransaction_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "RecurringTransaction"
    ADD CONSTRAINT "RecurringTransaction_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "TransactionAttachment"
    ADD CONSTRAINT "TransactionAttachment_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "TransactionAttachment"
    ADD CONSTRAINT "TransactionAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE "TransactionSplit"
    ADD CONSTRAINT "TransactionSplit_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;