-- Security/report split support: immutable audit hardening + internal nonce tracking

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "payloadHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "prevHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entryHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_sourceType_sourceId_idx" ON "AuditLog"("sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AuditLog_entryHash_key" ON "AuditLog"("entryHash");

CREATE TABLE IF NOT EXISTS "InternalLogNonce" (
  "nonce" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalLogNonce_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX IF NOT EXISTS "InternalLogNonce_serviceId_createdAt_idx" ON "InternalLogNonce"("serviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "InternalLogNonce_createdAt_idx" ON "InternalLogNonce"("createdAt");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is immutable: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
