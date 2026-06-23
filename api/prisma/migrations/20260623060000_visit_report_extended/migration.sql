-- visit_reports: add visit_type, interest_level, new_leads, next_visit_date
ALTER TABLE "visit_reports"
  ADD COLUMN IF NOT EXISTS "visit_type"      TEXT,
  ADD COLUMN IF NOT EXISTS "interest_level"  TEXT,
  ADD COLUMN IF NOT EXISTS "new_leads"       INTEGER,
  ADD COLUMN IF NOT EXISTS "next_visit_date" DATE;
