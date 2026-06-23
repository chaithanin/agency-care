-- Add metadata JSON to audit_logs for storing before/after diff
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;
