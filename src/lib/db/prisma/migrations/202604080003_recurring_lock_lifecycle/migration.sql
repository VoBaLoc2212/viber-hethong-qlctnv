-- Recurring run lock lifecycle: allow one lock key, with status + updatedAt for retry policy
ALTER TABLE "AuditLog"
ADD COLUMN IF NOT EXISTS "processingStatus" TEXT,
ADD COLUMN IF NOT EXISTS "processingUpdatedAt" TIMESTAMP(3);

-- Keep one lock row per key
CREATE UNIQUE INDEX IF NOT EXISTS "auditlog_unique_recurring_run_lock"
ON "AuditLog" ("action", "entityType", "entityId")
WHERE "action" = 'RECURRING_RUN_LOCK' AND "entityType" = 'RECURRING_BATCH';

-- Fast lookup for stale PROCESSING locks
CREATE INDEX IF NOT EXISTS "auditlog_recurring_lock_status_idx"
ON "AuditLog" ("entityId", "processingStatus", "processingUpdatedAt")
WHERE "action" = 'RECURRING_RUN_LOCK' AND "entityType" = 'RECURRING_BATCH';
