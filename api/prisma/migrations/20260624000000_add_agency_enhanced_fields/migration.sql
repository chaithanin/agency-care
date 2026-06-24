-- Add VIP to AgencyLevel enum
ALTER TYPE "AgencyLevel" ADD VALUE IF NOT EXISTS 'VIP' BEFORE 'A';

-- Add new AuditAction enum values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'assign';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'unassign';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'restore';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'approve';

-- Add 21 new fields to agencies table

-- ข้อมูลสัญญา
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "agreement_active"     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "agreement_start_date" DATE,
  ADD COLUMN IF NOT EXISTS "agreement_expiry"     DATE;

-- ผลการขาย
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "sells_our_projects"   BOOLEAN,
  ADD COLUMN IF NOT EXISTS "last_sale_date"        DATE,
  ADD COLUMN IF NOT EXISTS "last_units_sold"       INTEGER,
  ADD COLUMN IF NOT EXISTS "total_units_sold"      INTEGER,
  ADD COLUMN IF NOT EXISTS "agency_score"          TEXT;

-- สำนักงาน
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "physical_office"         BOOLEAN,
  ADD COLUMN IF NOT EXISTS "num_sales_agents"         INTEGER,
  ADD COLUMN IF NOT EXISTS "advertises_our_projects" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "paid_ads"                BOOLEAN;

-- Social Media
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "facebook"    TEXT,
  ADD COLUMN IF NOT EXISTS "instagram"   TEXT,
  ADD COLUMN IF NOT EXISTS "tiktok"      TEXT,
  ADD COLUMN IF NOT EXISTS "linkedin"    TEXT,
  ADD COLUMN IF NOT EXISTS "other_social" TEXT;

-- Property Focus
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "property_types" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "main_projects"  TEXT[] NOT NULL DEFAULT '{}';

-- Agency Management
ALTER TABLE "agencies"
  ADD COLUMN IF NOT EXISTS "visit_frequency"   INTEGER,
  ADD COLUMN IF NOT EXISTS "assigned_closer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "approval_status"   TEXT NOT NULL DEFAULT 'active';

-- Foreign key for assignedCloser → Employee
ALTER TABLE "agencies"
  ADD CONSTRAINT "agencies_assigned_closer_id_fkey"
  FOREIGN KEY ("assigned_closer_id")
  REFERENCES "employees"("id")
  ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS "agencies_assigned_closer_id_idx" ON "agencies"("assigned_closer_id");
CREATE INDEX IF NOT EXISTS "agencies_agreement_expiry_idx"    ON "agencies"("agreement_expiry");
CREATE INDEX IF NOT EXISTS "agencies_approval_status_idx"     ON "agencies"("approval_status");
