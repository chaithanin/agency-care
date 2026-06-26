-- Document Center: unified SVA + SVR + MPA module
CREATE TABLE "document_records" (
    "id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_number" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "required_signers" TEXT[] NOT NULL DEFAULT ARRAY['employee','supervisor'],
    "company_name" TEXT NOT NULL DEFAULT 'บริษัท ทีทีจี โฮลดิ้ง จำกัด',
    "declaration" TEXT,
    "notes" TEXT,
    "kpi_site_visit" INTEGER,
    "kpi_followup" INTEGER,
    "kpi_new_agency" INTEGER,
    "kpi_training" INTEGER,
    "kpi_sales" INTEGER,
    "actual_site_visit" INTEGER,
    "actual_followup" INTEGER,
    "actual_new_agency" INTEGER,
    "actual_training" INTEGER,
    "actual_sales" INTEGER,
    "working_days" INTEGER,
    "leave_days" INTEGER,
    "gps_compliance_pct" INTEGER,
    "photo_compliance_pct" INTEGER,
    "supervisor_score" INTEGER,
    "supervisor_comment" TEXT,
    "supervisor_plan" TEXT,
    "employee_comment" TEXT,
    "ai_analysis" JSONB,
    "employee_id" TEXT NOT NULL,
    "supervisor_id" TEXT,
    "closer_id" TEXT,
    "approved_by_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3),
    "effective_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "document_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_records_doc_number_key" ON "document_records"("doc_number");
CREATE INDEX "document_records_doc_type_year_month_idx" ON "document_records"("doc_type","year","month");
CREATE INDEX "document_records_employee_id_idx" ON "document_records"("employee_id");
CREATE INDEX "document_records_status_idx" ON "document_records"("status");

CREATE TABLE "doc_rows" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "row_type" TEXT NOT NULL DEFAULT 'schedule',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visit_date" TIMESTAMP(3),
    "visit_time" TEXT,
    "agency_id" TEXT,
    "agency_name" TEXT,
    "contact_person" TEXT,
    "province" TEXT,
    "visit_type" TEXT DEFAULT 'site_visit',
    "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'scheduled',
    "planned_time" TEXT,
    "actual_time" TEXT,
    "result" TEXT,
    "kpi_name" TEXT,
    "kpi_target" INTEGER,
    "kpi_actual" INTEGER,
    "activity_name" TEXT,
    "activity_done" BOOLEAN DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "doc_rows_document_id_idx" ON "doc_rows"("document_id");

CREATE TABLE "doc_signatures" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "signer_type" TEXT NOT NULL,
    "signed_by_id" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature_data" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_signatures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "doc_signatures_document_id_idx" ON "doc_signatures"("document_id");

CREATE TABLE "doc_audit_logs" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "doc_audit_logs_document_id_idx" ON "doc_audit_logs"("document_id");

CREATE TABLE "doc_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "doc_versions_document_id_idx" ON "doc_versions"("document_id");

-- Foreign keys
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_closer_id_fkey" FOREIGN KEY ("closer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_records" ADD CONSTRAINT "document_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_rows" ADD CONSTRAINT "doc_rows_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_signatures" ADD CONSTRAINT "doc_signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_signatures" ADD CONSTRAINT "doc_signatures_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_audit_logs" ADD CONSTRAINT "doc_audit_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_audit_logs" ADD CONSTRAINT "doc_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_versions" ADD CONSTRAINT "doc_versions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
