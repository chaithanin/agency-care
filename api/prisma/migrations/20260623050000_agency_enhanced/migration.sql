-- Enhanced Agency profile fields
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "remark"  TEXT;
