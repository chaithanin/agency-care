-- Smart Notification Center tables

CREATE TABLE IF NOT EXISTS "notification_settings" (
  "id"            TEXT NOT NULL,
  "notif_type"    TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "is_enabled"    BOOLEAN NOT NULL DEFAULT TRUE,
  "cron_time"     TEXT NOT NULL,
  "channel_line"  BOOLEAN NOT NULL DEFAULT TRUE,
  "channel_email" BOOLEAN NOT NULL DEFAULT FALSE,
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_settings_notif_type_key" UNIQUE ("notif_type")
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
  "id"            TEXT NOT NULL,
  "notif_type"    TEXT NOT NULL,
  "channel"       TEXT NOT NULL,
  "recipient_id"  TEXT NOT NULL,
  "role"          TEXT NOT NULL,
  "task_count"    INTEGER NOT NULL DEFAULT 0,
  "overdue_count" INTEGER NOT NULL DEFAULT 0,
  "message_body"  TEXT,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "sent_at"       TIMESTAMPTZ,
  "read_at"       TIMESTAMPTZ,
  "error_msg"     TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_logs_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "notification_logs_notif_type_created_at_idx"
  ON "notification_logs"("notif_type", "created_at");
CREATE INDEX IF NOT EXISTS "notification_logs_recipient_id_idx"
  ON "notification_logs"("recipient_id");
CREATE INDEX IF NOT EXISTS "notification_logs_status_idx"
  ON "notification_logs"("status");

-- Seed default settings
INSERT INTO "notification_settings" ("id","notif_type","label","cron_time","is_enabled","channel_line","updated_at")
VALUES
  ('nset-daily',     'daily_brief', 'Daily Brief (08:00)',    '0 8 * * 1-6',  TRUE, TRUE, NOW()),
  ('nset-midday',    'midday',      'Midday Reminder (12:00)','0 12 * * 1-6', TRUE, TRUE, NOW()),
  ('nset-afternoon', 'afternoon',   'Afternoon Alert (16:00)','0 16 * * 1-6', TRUE, TRUE, NOW()),
  ('nset-evening',   'evening',     'Evening Escalation (18:00)','0 18 * * 1-6',TRUE,TRUE, NOW())
ON CONFLICT ("notif_type") DO NOTHING;
