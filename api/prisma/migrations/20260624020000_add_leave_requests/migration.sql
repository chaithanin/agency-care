-- Create leave_requests table
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id"              TEXT NOT NULL,
  "employee_id"     TEXT NOT NULL,
  "leave_type"      TEXT NOT NULL,
  "start_date"      DATE NOT NULL,
  "end_date"        DATE NOT NULL,
  "days"            INTEGER NOT NULL,
  "reason"          TEXT,
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "approved_by_id"  TEXT,
  "approved_at"     TIMESTAMP(3),
  "rejected_reason" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX IF NOT EXISTS "leave_requests_start_date_idx" ON "leave_requests"("start_date");

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_requests_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
