-- Ensure single in-flight recurring run per idempotency key (lock by hashed key)
CREATE UNIQUE INDEX "auditlog_unique_recurring_run_lock"
ON "AuditLog" ("action", "entityType", "entityId")
WHERE "action" = 'RECURRING_RUN_LOCK' AND "entityType" = 'RECURRING_BATCH';
