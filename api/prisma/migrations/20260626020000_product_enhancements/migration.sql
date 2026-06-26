ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "description"    TEXT,
  ADD COLUMN IF NOT EXISTS "project_type"   TEXT,
  ADD COLUMN IF NOT EXISTS "unit"           TEXT,
  ADD COLUMN IF NOT EXISTS "quota"          INTEGER,
  ADD COLUMN IF NOT EXISTS "marketing_link" TEXT;
