-- PR Tracking Module

CREATE TABLE IF NOT EXISTS "purchase_requests" (
  "id"              TEXT NOT NULL,
  "pr_number"       TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by_id"   TEXT NOT NULL,
  "department"      TEXT NOT NULL,
  "pr_type"         TEXT NOT NULL,
  "priority"        TEXT NOT NULL DEFAULT 'medium',
  "status"          TEXT NOT NULL DEFAULT 'draft',
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "note"            TEXT,
  "budget_total"    NUMERIC(14,2),
  "due_date"        DATE,
  "responsible_id"  TEXT,
  "approver_id"     TEXT,
  "approved_at"     TIMESTAMPTZ,
  "closed_at"       TIMESTAMPTZ,
  "cancel_reason"   TEXT,
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_requests_pr_number_key" UNIQUE ("pr_number"),
  CONSTRAINT "purchase_requests_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "purchase_requests_responsible_id_fkey"
    FOREIGN KEY ("responsible_id") REFERENCES "employees"("id") ON DELETE SET NULL,
  CONSTRAINT "purchase_requests_approver_id_fkey"
    FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "purchase_requests_status_idx" ON "purchase_requests"("status");
CREATE INDEX IF NOT EXISTS "purchase_requests_created_by_idx" ON "purchase_requests"("created_by_id");
CREATE INDEX IF NOT EXISTS "purchase_requests_responsible_idx" ON "purchase_requests"("responsible_id");
CREATE INDEX IF NOT EXISTS "purchase_requests_due_date_idx" ON "purchase_requests"("due_date");

CREATE TABLE IF NOT EXISTS "pr_items" (
  "id"          TEXT NOT NULL,
  "pr_id"       TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "detail"      TEXT,
  "qty"         NUMERIC(10,2) NOT NULL DEFAULT 1,
  "unit"        TEXT,
  "budget"      NUMERIC(14,2),
  "needed_by"   DATE,
  CONSTRAINT "pr_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pr_items_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "pr_items_pr_id_idx" ON "pr_items"("pr_id");

CREATE TABLE IF NOT EXISTS "pr_comments" (
  "id"          TEXT NOT NULL,
  "pr_id"       TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pr_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pr_comments_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE,
  CONSTRAINT "pr_comments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "pr_comments_pr_id_idx" ON "pr_comments"("pr_id");

CREATE TABLE IF NOT EXISTS "pr_activities" (
  "id"          TEXT NOT NULL,
  "pr_id"       TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "action"      TEXT NOT NULL,
  "old_value"   TEXT,
  "new_value"   TEXT,
  "note"        TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pr_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pr_activities_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE,
  CONSTRAINT "pr_activities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "pr_activities_pr_id_idx" ON "pr_activities"("pr_id");
CREATE INDEX IF NOT EXISTS "pr_activities_created_at_idx" ON "pr_activities"("created_at");

CREATE TABLE IF NOT EXISTS "pr_checklists" (
  "id"          TEXT NOT NULL,
  "pr_id"       TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "is_done"     BOOLEAN NOT NULL DEFAULT FALSE,
  "done_at"     TIMESTAMPTZ,
  "done_by_id"  TEXT,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "pr_checklists_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pr_checklists_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "pr_checklists_pr_id_idx" ON "pr_checklists"("pr_id");

CREATE TABLE IF NOT EXISTS "pr_attachments" (
  "id"              TEXT NOT NULL,
  "pr_id"           TEXT NOT NULL,
  "file_name"       TEXT NOT NULL,
  "file_url"        TEXT NOT NULL,
  "file_size"       INTEGER,
  "mime_type"       TEXT,
  "uploaded_by_id"  TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pr_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pr_attachments_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "pr_attachments_pr_id_idx" ON "pr_attachments"("pr_id");

CREATE TABLE IF NOT EXISTS "pr_sequence" (
  "id"       TEXT NOT NULL DEFAULT 'singleton',
  "last_seq" INTEGER NOT NULL DEFAULT 0,
  "year"     INTEGER NOT NULL,
  CONSTRAINT "pr_sequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "pr_sequence" ("id","last_seq","year") VALUES ('singleton', 0, EXTRACT(YEAR FROM NOW())::INTEGER)
ON CONFLICT ("id") DO NOTHING;
