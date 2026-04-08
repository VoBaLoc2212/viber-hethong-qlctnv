-- Ensure one approval row per expense transaction to prevent duplicate sync inserts
DELETE FROM "Approval"
WHERE "id" IN (
  SELECT d."id"
  FROM (
    SELECT "id",
           ROW_NUMBER() OVER (
             PARTITION BY "transactionId"
             ORDER BY "createdAt" ASC, "id" ASC
           ) AS rn
    FROM "Approval"
  ) AS d
  WHERE d.rn > 1
);

CREATE UNIQUE INDEX "approval_unique_transaction"
ON "Approval"("transactionId");
