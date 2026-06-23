-- Expand VisitStatus enum with pre-site visit statuses
ALTER TYPE "VisitStatus" ADD VALUE IF NOT EXISTS 'waiting_confirmation';
ALTER TYPE "VisitStatus" ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE "VisitStatus" ADD VALUE IF NOT EXISTS 'rescheduled';
ALTER TYPE "VisitStatus" ADD VALUE IF NOT EXISTS 'on_route';

-- New enums
CREATE TYPE "CallConfirmResult" AS ENUM ('confirmed', 'rescheduled', 'no_answer', 'cancelled');
CREATE TYPE "AssignmentPlanStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'published', 'active', 'closed');

-- Add call-confirm fields to visit_plans
ALTER TABLE "visit_plans"
  ADD COLUMN IF NOT EXISTS "call_confirm_at"     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "call_confirm_result" "CallConfirmResult",
  ADD COLUMN IF NOT EXISTS "call_note"           TEXT,
  ADD COLUMN IF NOT EXISTS "rescheduled_to"      DATE;

-- Create assignment_plans table
CREATE TABLE IF NOT EXISTS "assignment_plans" (
  "id"              TEXT NOT NULL,
  "period"          TEXT NOT NULL,
  "title"           TEXT,
  "status"          "AssignmentPlanStatus" NOT NULL DEFAULT 'draft',
  "note"            TEXT,
  "total_agencies"  INTEGER NOT NULL DEFAULT 0,
  "total_sales"     INTEGER NOT NULL DEFAULT 0,
  "created_by_id"   TEXT NOT NULL,
  "approved_by_id"  TEXT,
  "approved_at"     TIMESTAMP,
  "published_at"    TIMESTAMP,
  "created_at"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "assignment_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assignment_plans_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "assignment_plans_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "assignment_plans_period_idx" ON "assignment_plans"("period");
CREATE INDEX IF NOT EXISTS "assignment_plans_status_idx" ON "assignment_plans"("status");

-- Create plan_versions table
CREATE TABLE IF NOT EXISTS "plan_versions" (
  "id"              TEXT NOT NULL,
  "plan_id"         TEXT NOT NULL,
  "version_no"      INTEGER NOT NULL,
  "note"            TEXT,
  "is_current"      BOOLEAN NOT NULL DEFAULT false,
  "created_by_id"   TEXT NOT NULL,
  "created_at"      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plan_versions_plan_id_version_no_key" UNIQUE ("plan_id", "version_no"),
  CONSTRAINT "plan_versions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "assignment_plans"("id") ON DELETE CASCADE,
  CONSTRAINT "plan_versions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "plan_versions_plan_id_idx" ON "plan_versions"("plan_id");

-- Create plan_version_items table
CREATE TABLE IF NOT EXISTS "plan_version_items" (
  "id"          TEXT NOT NULL,
  "version_id"  TEXT NOT NULL,
  "agency_id"   TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "is_locked"   BOOLEAN NOT NULL DEFAULT false,
  "note"        TEXT,
  CONSTRAINT "plan_version_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plan_version_items_version_id_agency_id_key" UNIQUE ("version_id", "agency_id"),
  CONSTRAINT "plan_version_items_version_id_fkey"
    FOREIGN KEY ("version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE,
  CONSTRAINT "plan_version_items_agency_id_fkey"
    FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE,
  CONSTRAINT "plan_version_items_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "plan_version_items_vid_aid_key" ON "plan_version_items"("version_id", "agency_id");
CREATE INDEX IF NOT EXISTS "plan_version_items_version_id_idx" ON "plan_version_items"("version_id");
CREATE INDEX IF NOT EXISTS "plan_version_items_agency_id_idx" ON "plan_version_items"("agency_id");
CREATE INDEX IF NOT EXISTS "plan_version_items_employee_id_idx" ON "plan_version_items"("employee_id");
