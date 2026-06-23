-- Task enums
CREATE TYPE "TaskPriority" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "TaskStatus"   AS ENUM ('pending', 'in_progress', 'done', 'overdue');
CREATE TYPE "TaskType"     AS ENUM ('manual', 'auto', 'ai');

-- Task table
CREATE TABLE "tasks" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "due_date"       DATE,
  "priority"       "TaskPriority" NOT NULL DEFAULT 'medium',
  "status"         "TaskStatus"   NOT NULL DEFAULT 'pending',
  "type"           "TaskType"     NOT NULL DEFAULT 'manual',
  "assigned_to_id" TEXT NOT NULL,
  "agency_id"      TEXT,
  "visit_plan_id"  TEXT,
  "created_by_id"  TEXT,
  "done_at"        TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_assigned_to_id_status_idx" ON "tasks"("assigned_to_id", "status");
CREATE INDEX "tasks_status_due_date_idx"        ON "tasks"("status", "due_date");
CREATE INDEX "tasks_agency_id_idx"              ON "tasks"("agency_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_visit_plan_id_fkey"
  FOREIGN KEY ("visit_plan_id") REFERENCES "visit_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InAppNotification table
CREATE TABLE "in_app_notifications" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "read"       BOOLEAN NOT NULL DEFAULT false,
  "link"       TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "in_app_notifications_user_id_read_idx"       ON "in_app_notifications"("user_id", "read");
CREATE INDEX "in_app_notifications_user_id_created_at_idx" ON "in_app_notifications"("user_id", "created_at");

ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
