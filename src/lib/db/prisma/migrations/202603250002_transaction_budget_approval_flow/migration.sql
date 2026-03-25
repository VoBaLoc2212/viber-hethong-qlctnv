-- Add nullable budget link for transactions (enforced at application level for EXPENSE)
ALTER TABLE "Transaction" ADD COLUMN "budgetId" TEXT;

-- Add indexes for query/filter performance
CREATE INDEX "Transaction_budgetId_idx" ON "Transaction"("budgetId");
CREATE INDEX "Transaction_departmentId_idx" ON "Transaction"("departmentId");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- Add approval step support for 2-level workflow
ALTER TABLE "Approval" ADD COLUMN "step" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Approval" ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Add approval indexes
CREATE INDEX "Approval_transactionId_step_idx" ON "Approval"("transactionId", "step");
CREATE INDEX "Approval_approverId_status_idx" ON "Approval"("approverId", "status");

-- Add foreign key from transaction to budget
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_budgetId_fkey"
  FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
