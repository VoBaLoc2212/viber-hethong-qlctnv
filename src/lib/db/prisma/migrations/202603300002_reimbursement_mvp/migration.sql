-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM (
  'PENDING_APPROVAL',
  'ADVANCE_APPROVED',
  'ADVANCE_PAID',
  'SETTLEMENT_SUBMITTED',
  'SETTLEMENT_REVIEWED',
  'COMPLETED',
  'REJECTED'
);

-- CreateEnum
CREATE TYPE "SettlementDirection" AS ENUM (
  'RETURN_TO_COMPANY',
  'PAY_TO_EMPLOYEE',
  'NO_CHANGE'
);

-- AlterTable
ALTER TABLE "Reimbursement"
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "paidById" TEXT,
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "settlementDirection" "SettlementDirection",
  ADD COLUMN "settlementNote" TEXT,
  ADD COLUMN "attachmentsJson" JSONB,
  ADD COLUMN "status" "ReimbursementStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  ADD COLUMN "advanceRequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "advanceApprovedAt" TIMESTAMP(3),
  ADD COLUMN "advancePaidAt" TIMESTAMP(3),
  ADD COLUMN "settlementSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "settlementReviewedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill
UPDATE "Reimbursement"
SET
  "purpose" = COALESCE("purpose", 'Hoàn ứng công tác'),
  "status" = CASE
    WHEN "settledAt" IS NOT NULL THEN 'COMPLETED'::"ReimbursementStatus"
    WHEN "actualAmount" IS NOT NULL THEN 'SETTLEMENT_SUBMITTED'::"ReimbursementStatus"
    ELSE 'PENDING_APPROVAL'::"ReimbursementStatus"
  END,
  "advanceRequestedAt" = COALESCE("advanceRequestedAt", "createdAt"),
  "settlementSubmittedAt" = COALESCE("settlementSubmittedAt", "settledAt"),
  "completedAt" = COALESCE("completedAt", "settledAt"),
  "updatedAt" = COALESCE("updatedAt", "createdAt");

ALTER TABLE "Reimbursement"
  ALTER COLUMN "purpose" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Reimbursement_employeeId_createdAt_idx" ON "Reimbursement"("employeeId", "createdAt");
CREATE INDEX "Reimbursement_status_createdAt_idx" ON "Reimbursement"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
