-- Add agency_score_num column for AI Score 0-100
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "agency_score_num" INTEGER DEFAULT 0;

-- Create kpi_targets table
CREATE TABLE IF NOT EXISTS "kpi_targets" (
  "id"               TEXT NOT NULL,
  "employee_id"      TEXT NOT NULL,
  "period"           TEXT NOT NULL,
  "visit_target"     INTEGER,
  "new_agency_target" INTEGER,
  "sales_target"     DOUBLE PRECISION,
  "followup_target"  INTEGER,
  "visit_actual"     INTEGER DEFAULT 0,
  "new_agency_actual" INTEGER DEFAULT 0,
  "sales_actual"     DOUBLE PRECISION DEFAULT 0,
  "followup_actual"  INTEGER DEFAULT 0,
  "last_calc_at"     TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_targets_employee_id_period_key" ON "kpi_targets"("employee_id", "period");
CREATE INDEX IF NOT EXISTS "kpi_targets_period_idx" ON "kpi_targets"("period");

ALTER TABLE "kpi_targets"
  ADD CONSTRAINT "kpi_targets_employee_id_fkey"
  FOREIGN KEY ("employee_id")
  REFERENCES "employees"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
