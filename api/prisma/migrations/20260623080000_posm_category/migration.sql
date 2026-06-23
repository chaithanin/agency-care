-- Add category and description to posm_items
ALTER TABLE "posm_items"
  ADD COLUMN IF NOT EXISTS "category"    TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS "description" TEXT;
