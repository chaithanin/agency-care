-- VisitPlan enhancements
ALTER TABLE "visit_plans"
  ADD COLUMN IF NOT EXISTS "action_type"     TEXT,
  ADD COLUMN IF NOT EXISTS "request_details" TEXT,
  ADD COLUMN IF NOT EXISTS "priority"        TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS "is_recurring"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "recurring_freq"  TEXT,
  ADD COLUMN IF NOT EXISTS "recurring_until" DATE;

-- Task enhancements
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "tag"             TEXT,
  ADD COLUMN IF NOT EXISTS "customer_name"   TEXT,
  ADD COLUMN IF NOT EXISTS "is_recurring"    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "recurring_freq"  TEXT,
  ADD COLUMN IF NOT EXISTS "recurring_until" DATE;

CREATE INDEX IF NOT EXISTS "visit_plans_action_type_idx" ON "visit_plans"("action_type");
CREATE INDEX IF NOT EXISTS "tasks_tag_idx" ON "tasks"("tag");
