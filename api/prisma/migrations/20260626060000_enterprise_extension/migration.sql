-- Enterprise Extension Migration
-- Adds: regions, branches, departments, expense_reports, training_records,
--        employee_evaluations, agency_scores, approval_rules, master_data

CREATE TABLE "regions" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "code"       TEXT NOT NULL UNIQUE,
  "name"       TEXT NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "branches" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "code"       TEXT NOT NULL UNIQUE,
  "name"       TEXT NOT NULL,
  "region_id"  TEXT,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "branches_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL
);
CREATE INDEX "branches_region_id_idx" ON "branches"("region_id");

CREATE TABLE "departments" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "code"       TEXT NOT NULL UNIQUE,
  "name"       TEXT NOT NULL,
  "manager_id" TEXT,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "expense_reports" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "employee_id"    TEXT NOT NULL,
  "visit_plan_id"  TEXT,
  "date"           DATE NOT NULL,
  "category"       TEXT NOT NULL DEFAULT 'other',
  "amount"         DECIMAL(10,2) NOT NULL,
  "description"    TEXT,
  "receipt_url"    TEXT,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "approved_by_id" TEXT,
  "approved_at"    TIMESTAMP(3),
  "note"           TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_reports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id"),
  CONSTRAINT "expense_reports_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "expense_reports_employee_id_idx" ON "expense_reports"("employee_id");
CREATE INDEX "expense_reports_status_idx" ON "expense_reports"("status");
CREATE INDEX "expense_reports_date_idx" ON "expense_reports"("date");

CREATE TABLE "training_records" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "employee_id"     TEXT NOT NULL,
  "training_name"   TEXT NOT NULL,
  "description"     TEXT,
  "training_date"   DATE NOT NULL,
  "hours"           INTEGER,
  "score"           INTEGER,
  "passed"          BOOLEAN NOT NULL DEFAULT false,
  "certificate"     TEXT,
  "notes"           TEXT,
  "created_by_id"   TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id"),
  CONSTRAINT "training_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
);
CREATE INDEX "training_records_employee_id_idx" ON "training_records"("employee_id");

CREATE TABLE "employee_evaluations" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "employee_id"     TEXT NOT NULL,
  "month"           INTEGER NOT NULL,
  "year"            INTEGER NOT NULL,
  "kpi_score"       INTEGER,
  "behavior_score"  INTEGER,
  "overall_score"   INTEGER,
  "grade"           TEXT,
  "strengths"       TEXT,
  "improvements"    TEXT,
  "goals"           TEXT,
  "evaluated_by_id" TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id"),
  CONSTRAINT "employee_evaluations_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id"),
  CONSTRAINT "employee_evaluations_unique" UNIQUE ("employee_id", "year", "month")
);
CREATE INDEX "employee_evaluations_employee_id_idx" ON "employee_evaluations"("employee_id");

CREATE TABLE "agency_scores" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "agency_id"      TEXT NOT NULL,
  "month"          INTEGER NOT NULL,
  "year"           INTEGER NOT NULL,
  "visit_score"    INTEGER,
  "sales_score"    INTEGER,
  "growth_score"   INTEGER,
  "risk_score"     INTEGER,
  "overall_score"  INTEGER,
  "grade"          TEXT,
  "notes"          TEXT,
  "created_by_id"  TEXT NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agency_scores_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id"),
  CONSTRAINT "agency_scores_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id"),
  CONSTRAINT "agency_scores_unique" UNIQUE ("agency_id", "year", "month")
);
CREATE INDEX "agency_scores_agency_id_idx" ON "agency_scores"("agency_id");

CREATE TABLE "approval_rules" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "module"      TEXT NOT NULL,
  "min_amount"  DECIMAL(12,2),
  "max_amount"  DECIMAL(12,2),
  "level1_role" TEXT NOT NULL DEFAULT 'closer',
  "level2_role" TEXT,
  "level3_role" TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default approval rules
INSERT INTO "approval_rules" ("id","module","level1_role","level2_role","created_at") VALUES
  ('apr-leave','leave','closer','admin',NOW()),
  ('apr-pr','pr','closer','admin',NOW()),
  ('apr-expense','expense','closer','admin',NOW()),
  ('apr-agency','agency','closer','admin',NOW()),
  ('apr-document','document','closer','admin',NOW());

CREATE TABLE "master_data" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "category"   TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "name_en"    TEXT NOT NULL,
  "name_th"    TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "metadata"   JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_data_category_code_unique" UNIQUE ("category","code")
);
CREATE INDEX "master_data_category_idx" ON "master_data"("category");

-- Seed master data
INSERT INTO "master_data" ("id","category","code","name_en","name_th","sort_order","created_at") VALUES
  -- Visit Types
  ('md-vt-1','visit_type','site_visit','Site Visit','เข้าเยี่ยม',1,NOW()),
  ('md-vt-2','visit_type','follow_up','Follow-up','ติดตาม',2,NOW()),
  ('md-vt-3','visit_type','training','Training','อบรม',3,NOW()),
  ('md-vt-4','visit_type','new_agency','New Agency','เปิด Agency ใหม่',4,NOW()),
  -- Task Types
  ('md-tt-1','task_type','call','Call','โทร',1,NOW()),
  ('md-tt-2','task_type','email','Email','อีเมล',2,NOW()),
  ('md-tt-3','task_type','meeting','Meeting','ประชุม',3,NOW()),
  ('md-tt-4','task_type','follow_up','Follow-up','ติดตาม',4,NOW()),
  ('md-tt-5','task_type','document','Document','เอกสาร',5,NOW()),
  -- Agency Types
  ('md-at-1','agency_type','gold','Gold','Gold',1,NOW()),
  ('md-at-2','agency_type','silver','Silver','Silver',2,NOW()),
  ('md-at-3','agency_type','bronze','Bronze','Bronze',3,NOW()),
  -- Priority
  ('md-pr-1','priority','urgent','Urgent','ด่วนมาก',1,NOW()),
  ('md-pr-2','priority','high','High','สูง',2,NOW()),
  ('md-pr-3','priority','medium','Medium','ปานกลาง',3,NOW()),
  ('md-pr-4','priority','low','Low','ต่ำ',4,NOW()),
  -- Reason Codes
  ('md-rc-1','reason_code','no_answer','No Answer','ไม่รับสาย',1,NOW()),
  ('md-rc-2','reason_code','postponed','Postponed','เลื่อนนัด',2,NOW()),
  ('md-rc-3','reason_code','cancelled','Cancelled by Agency','Agency ยกเลิก',3,NOW()),
  ('md-rc-4','reason_code','sick','Sick Leave','ลาป่วย',4,NOW());
