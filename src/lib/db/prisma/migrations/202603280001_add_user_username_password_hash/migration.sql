-- Add username and passwordHash to User table for databases created before auth fields existed

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username" TEXT,
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- Backfill deterministic values for legacy rows
UPDATE "User"
SET
  "username" = COALESCE("username", lower(split_part("email", '@', 1))),
  "passwordHash" = COALESCE("passwordHash", 'DISABLED')
WHERE "username" IS NULL OR "passwordHash" IS NULL;

-- Resolve potential username duplicates from email-local-part backfill
WITH ranked AS (
  SELECT
    "id",
    "username",
    ROW_NUMBER() OVER (PARTITION BY "username" ORDER BY "createdAt", "id") AS rn
  FROM "User"
)
UPDATE "User" u
SET "username" = CONCAT(r."username", '_', substr(u."id", 1, 8))
FROM ranked r
WHERE u."id" = r."id" AND r.rn > 1;

ALTER TABLE "User"
  ALTER COLUMN "username" SET NOT NULL,
  ALTER COLUMN "passwordHash" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
