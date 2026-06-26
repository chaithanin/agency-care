-- CreateTable appointments
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" TEXT NOT NULL,
  "appt_no" TEXT NOT NULL,
  "agency_id" TEXT NOT NULL,
  "contact_person" TEXT,
  "contact_phone" TEXT,
  "sale_id" TEXT,
  "closer_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "appt_type" TEXT NOT NULL DEFAULT 'showroom',
  "meeting_type" TEXT NOT NULL DEFAULT 'project_presentation',
  "meeting_room" TEXT,
  "appt_date" DATE NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "purpose" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "participant_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "check_in_at" TIMESTAMP(3),
  "check_out_at" TIMESTAMP(3),
  "reception_name" TEXT,
  "meeting_room_actual" TEXT,
  "notes" TEXT,
  "cancel_reason" TEXT,
  "confirmed_by_id" TEXT,
  "confirmed_at" TIMESTAMP(3),
  "reminder_1d_sent" BOOLEAN NOT NULL DEFAULT false,
  "reminder_2h_sent" BOOLEAN NOT NULL DEFAULT false,
  "reminder_30m_sent" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_appt_no_key" UNIQUE ("appt_no")
);

-- CreateTable meeting_reports
CREATE TABLE IF NOT EXISTS "meeting_reports" (
  "id" TEXT NOT NULL,
  "appointment_id" TEXT NOT NULL,
  "topics" TEXT,
  "promotions" TEXT,
  "projects" TEXT,
  "new_leads" INTEGER NOT NULL DEFAULT 0,
  "sales_opportunity" TEXT,
  "interest_score" INTEGER,
  "next_appt_date" TIMESTAMP(3),
  "remarks" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meeting_reports_appointment_id_key" UNIQUE ("appointment_id")
);

-- CreateTable appt_attachments
CREATE TABLE IF NOT EXISTS "appt_attachments" (
  "id" TEXT NOT NULL,
  "appointment_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_type" TEXT,
  "uploaded_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appt_attachments_pkey" PRIMARY KEY ("id")
);
