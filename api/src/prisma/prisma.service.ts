import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildUrl() {
  const url = process.env.DATABASE_URL ?? '';
  if (url.includes('connection_limit')) return url;
  const sep = url.includes('?') ? '&' : '?';
  // Neon free tier: max 2 user connections. Limit pool to 1 so we stay within budget.
  return `${url}${sep}connection_limit=1&pool_timeout=15`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ datasources: { db: { url: buildUrl() } } });
  }

  async onModuleInit() {
    // Use lazy connection: don't call $connect() at startup.
    // Prisma connects on the first actual query, which happens after Cloud Run
    // health check passes and the old revision's connections are released.
    // This prevents "too many connections" on Neon free tier during rolling deploy.
    this.applyPendingMigrations().catch((err) =>
      this.logger.warn(`Broadcast migration deferred: ${String(err).slice(0, 200)}`),
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async applyPendingMigrations() {
    // Idempotent: creates broadcast tables if they don't exist yet.
    // Uses the shared connection pool (connection_limit=1).
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "broadcasts" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'news',
        "priority" TEXT NOT NULL DEFAULT 'normal',
        "content" TEXT NOT NULL,
        "image_url" TEXT,
        "buttons" JSONB,
        "recipient_type" TEXT NOT NULL DEFAULT 'all',
        "recipient_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "recipient_filter" JSONB,
        "schedule_type" TEXT NOT NULL DEFAULT 'immediate',
        "scheduled_at" TIMESTAMP(3),
        "recurring_freq" TEXT,
        "recurring_day" INTEGER,
        "recurring_time" TEXT,
        "recurring_until" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'draft',
        "sent_count" INTEGER NOT NULL DEFAULT 0,
        "delivered_count" INTEGER NOT NULL DEFAULT 0,
        "read_count" INTEGER NOT NULL DEFAULT 0,
        "click_count" INTEGER NOT NULL DEFAULT 0,
        "failed_count" INTEGER NOT NULL DEFAULT 0,
        "approval_required" BOOLEAN NOT NULL DEFAULT false,
        "approved_by_id" TEXT,
        "approved_at" TIMESTAMP(3),
        "rejected_reason" TEXT,
        "created_by_id" TEXT NOT NULL,
        "sent_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "broadcast_recipients" (
        "id" TEXT NOT NULL,
        "broadcast_id" TEXT NOT NULL,
        "employee_id" TEXT NOT NULL,
        "line_user_id" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "sent_at" TIMESTAMP(3),
        "error" TEXT,
        CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "broadcast_templates" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'news',
        "content" TEXT NOT NULL,
        "buttons" JSONB,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_by_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "broadcast_templates_pkey" PRIMARY KEY ("id")
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "broadcast_logs" (
        "id" TEXT NOT NULL,
        "broadcast_id" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "user_id" TEXT,
        "detail" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "broadcast_logs_pkey" PRIMARY KEY ("id")
      )
    `);

    await this.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_recipients_broadcast_id_employee_id_key"
      ON "broadcast_recipients"("broadcast_id", "employee_id")
    `).catch(() => {});

    await this.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "broadcasts_status_idx" ON "broadcasts"("status")
    `).catch(() => {});

    // Foreign keys — silently skip if already exist
    for (const sql of [
      `ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_approved_by_id_fkey"
       FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_id_fkey"
       FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey"
       FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_employee_id_fkey"
       FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "broadcast_templates" ADD CONSTRAINT "broadcast_templates_created_by_id_fkey"
       FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_broadcast_id_fkey"
       FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_user_id_fkey"
       FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    ]) {
      await this.$executeRawUnsafe(sql).catch(() => {});
    }

    // Seed default templates if table is empty
    const rows = await this.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "broadcast_templates"
    `;
    if (Number(rows[0].count) === 0) {
      const admins = await this.$queryRaw<{ id: string }[]>`
        SELECT id FROM "users" WHERE role = 'super_admin' LIMIT 1
      `;
      if (admins.length > 0) {
        const uid = admins[0].id;
        for (const [name, type, content] of [
          ['ข่าวบริษัท', 'news', '📢 ข่าวบริษัท\n\n[หัวข้อ]\n\n[รายละเอียด]\n\n📅 วันที่: [วันที่]'],
          ['โปรโมชั่น', 'promotion', '🎁 โปรโมชั่นพิเศษ\n\n✅ [รายละเอียด]\n⏰ ถึงวันที่: [วันที่]'],
          ['แจ้งอบรม', 'training', '📚 แจ้งอบรม\n\n[ชื่อหลักสูตร]\n📅 วันที่: [วันที่]\n📍 [สถานที่]'],
          ['แจ้งระบบปิด', 'it', '🔧 ระบบปิดปรับปรุง\n📅 [วันที่]\n🕐 [เวลา]-[เวลา]'],
          ['แจ้งวันหยุด', 'hr', '🎌 แจ้งวันหยุด: [ชื่อวันหยุด]\n📅 วันที่: [วันที่]'],
          ['แจ้งเหตุฉุกเฉิน', 'emergency', '🚨 แจ้งเหตุด่วน\n\n[รายละเอียด]\n\nติดต่อ: [เบอร์โทร]'],
        ]) {
          await this.$executeRawUnsafe(
            `INSERT INTO "broadcast_templates" ("id","name","type","content","is_active","created_by_id","created_at","updated_at")
             VALUES (gen_random_uuid()::text, $1, $2, $3, true, $4, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            name, type, content, uid,
          ).catch(() => {});
        }
      }
    }

    this.logger.log('Broadcast tables ready');

    // Add manager role to UserRole enum if not exists (PostgreSQL ALTER TYPE is idempotent via IF NOT EXISTS)
    await this.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'manager' BEFORE 'super_admin'`).catch(() => {});
    this.logger.log('Manager role ready');

    // Appointment tables
    await this.$executeRawUnsafe(`
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
      )
    `).catch(() => {});

    await this.$executeRawUnsafe(`
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
      )
    `).catch(() => {});

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "appt_attachments" (
        "id" TEXT NOT NULL,
        "appointment_id" TEXT NOT NULL,
        "file_name" TEXT NOT NULL,
        "file_url" TEXT NOT NULL,
        "file_type" TEXT,
        "uploaded_by_id" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "appt_attachments_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    for (const sql of [
      `CREATE INDEX IF NOT EXISTS "appointments_agency_id_idx" ON "appointments"("agency_id")`,
      `CREATE INDEX IF NOT EXISTS "appointments_sale_id_idx" ON "appointments"("sale_id")`,
      `CREATE INDEX IF NOT EXISTS "appointments_appt_date_idx" ON "appointments"("appt_date")`,
      `CREATE INDEX IF NOT EXISTS "appointments_status_idx" ON "appointments"("status")`,
      `ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "appointments" ADD CONSTRAINT "appointments_closer_id_fkey" FOREIGN KEY ("closer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "meeting_reports" ADD CONSTRAINT "meeting_reports_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "meeting_reports" ADD CONSTRAINT "meeting_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "appt_attachments" ADD CONSTRAINT "appt_attachments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ]) {
      await this.$executeRawUnsafe(sql).catch(() => {});
    }

    this.logger.log('Appointment tables ready');

    // Agency Acquisition Workflow tables
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "agency_leads" (
        "id" TEXT NOT NULL,
        "agency_name" TEXT NOT NULL,
        "contact_person" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "email" TEXT,
        "province" TEXT,
        "facebook" TEXT,
        "website" TEXT,
        "source" TEXT NOT NULL DEFAULT 'walk_in',
        "notes" TEXT,
        "status" TEXT NOT NULL DEFAULT 'new_lead',
        "assigned_to_id" TEXT,
        "assigned_at" TIMESTAMP(3),
        "qual_result" TEXT,
        "qual_has_office" BOOLEAN,
        "qual_agent_count" INTEGER,
        "qual_property_type" TEXT,
        "qual_does_marketing" BOOLEAN,
        "qual_has_potential" BOOLEAN,
        "qual_service_area" TEXT,
        "qual_notes" TEXT,
        "qualified_at" TIMESTAMP(3),
        "eval_relationship" INTEGER,
        "eval_business_potential" INTEGER,
        "eval_marketing" INTEGER,
        "eval_location" INTEGER,
        "eval_sales_team" INTEGER,
        "eval_financial" INTEGER,
        "eval_competition" INTEGER,
        "eval_total_score" INTEGER,
        "eval_notes" TEXT,
        "evaluated_at" TIMESTAMP(3),
        "approval_decision" TEXT,
        "approval_notes" TEXT,
        "approved_by_id" TEXT,
        "approved_at" TIMESTAMP(3),
        "reject_reason" TEXT,
        "agreement_no" TEXT,
        "agreement_start" DATE,
        "agreement_end" DATE,
        "agreement_url" TEXT,
        "agreement_signed" BOOLEAN NOT NULL DEFAULT false,
        "onboarding_checklist" JSONB,
        "onboarding_done_at" TIMESTAMP(3),
        "training_date" TIMESTAMP(3),
        "training_topics" TEXT,
        "training_trainer" TEXT,
        "training_score" INTEGER,
        "training_certified" BOOLEAN NOT NULL DEFAULT false,
        "first_sale_date" DATE,
        "first_sale_project" TEXT,
        "first_sale_units" INTEGER,
        "first_sale_value" DECIMAL(14,2),
        "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
        "ai_score" INTEGER,
        "recorded_by_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "agency_leads_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lead_contacts" (
        "id" TEXT NOT NULL,
        "lead_id" TEXT NOT NULL,
        "contact_date" TIMESTAMP(3) NOT NULL,
        "result" TEXT NOT NULL,
        "contacted_by" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "lead_contacts_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lead_appointment_entries" (
        "id" TEXT NOT NULL,
        "lead_id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "appt_date" TIMESTAMP(3) NOT NULL,
        "location" TEXT,
        "attendees" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "lead_appointment_entries_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lead_site_visits" (
        "id" TEXT NOT NULL,
        "lead_id" TEXT NOT NULL,
        "visited_at" TIMESTAMP(3),
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "report" TEXT,
        "ai_summary" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "lead_site_visits_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "lead_marketing_items" (
        "id" TEXT NOT NULL,
        "lead_id" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "quantity" INTEGER,
        "notes" TEXT,
        "delivered_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "lead_marketing_items_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    for (const sql of [
      `CREATE INDEX IF NOT EXISTS "agency_leads_status_idx" ON "agency_leads"("status")`,
      `CREATE INDEX IF NOT EXISTS "agency_leads_assigned_to_id_idx" ON "agency_leads"("assigned_to_id")`,
      `CREATE INDEX IF NOT EXISTS "lead_contacts_lead_id_idx" ON "lead_contacts"("lead_id")`,
      `CREATE INDEX IF NOT EXISTS "lead_appointment_entries_lead_id_idx" ON "lead_appointment_entries"("lead_id")`,
      `CREATE INDEX IF NOT EXISTS "lead_site_visits_lead_id_idx" ON "lead_site_visits"("lead_id")`,
      `CREATE INDEX IF NOT EXISTS "lead_marketing_items_lead_id_idx" ON "lead_marketing_items"("lead_id")`,
      `ALTER TABLE "agency_leads" ADD CONSTRAINT "agency_leads_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "agency_leads" ADD CONSTRAINT "agency_leads_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
      `ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "agency_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "lead_appointment_entries" ADD CONSTRAINT "lead_appointment_entries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "agency_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "lead_site_visits" ADD CONSTRAINT "lead_site_visits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "agency_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "lead_marketing_items" ADD CONSTRAINT "lead_marketing_items_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "agency_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ]) {
      await this.$executeRawUnsafe(sql).catch(() => {});
    }

    this.logger.log('Agency Acquisition tables ready');

    // agency_commissions table (migration 20260627010000)
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "agency_commissions" (
        "id" TEXT NOT NULL,
        "agency_id" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'commission',
        "amount" DECIMAL(12,2) NOT NULL,
        "period_date" DATE NOT NULL,
        "description" TEXT,
        "recorded_by_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "agency_commissions_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    for (const sql of [
      `CREATE INDEX IF NOT EXISTS "agency_commissions_agency_id_idx" ON "agency_commissions"("agency_id")`,
      `CREATE INDEX IF NOT EXISTS "agency_commissions_period_date_idx" ON "agency_commissions"("period_date")`,
      `ALTER TABLE "agency_commissions" ADD CONSTRAINT "agency_commissions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "agency_commissions" ADD CONSTRAINT "agency_commissions_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    ]) {
      await this.$executeRawUnsafe(sql).catch(() => {});
    }

    // automation_paused column on agencies (migration 20260627020000)
    await this.$executeRawUnsafe(
      `ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "automation_paused" BOOLEAN NOT NULL DEFAULT false`
    ).catch(() => {});

    // agency_deposits table (migration 20260629010000)
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "agency_deposits" (
        "id" TEXT NOT NULL,
        "lead_id" TEXT NOT NULL UNIQUE,
        "deposit_amount" DECIMAL(14,2) NOT NULL,
        "deposit_currency" TEXT NOT NULL DEFAULT 'THB',
        "deposit_date" DATE,
        "deposit_status" TEXT NOT NULL DEFAULT 'pending',
        "payment_method" TEXT,
        "bank_account" TEXT,
        "transfer_reference" TEXT,
        "refund_amount" DECIMAL(14,2),
        "refund_date" DATE,
        "refund_reason" TEXT,
        "agreement_no" TEXT,
        "released_at" TIMESTAMP(3),
        "ai_risk_score" INTEGER DEFAULT 0,
        "last_followup_date" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "agency_deposits_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    // deposit_transactions table (migration 20260629010001)
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "deposit_transactions" (
        "id" TEXT NOT NULL,
        "deposit_id" TEXT NOT NULL,
        "transaction_type" TEXT NOT NULL,
        "amount" DECIMAL(14,2) NOT NULL,
        "transaction_date" TIMESTAMP(3) NOT NULL,
        "reference" TEXT,
        "notes" TEXT,
        "recorded_by_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "deposit_transactions_pkey" PRIMARY KEY ("id")
      )
    `).catch(() => {});

    for (const sql of [
      `CREATE INDEX IF NOT EXISTS "agency_deposits_lead_id_idx" ON "agency_deposits"("lead_id")`,
      `CREATE INDEX IF NOT EXISTS "agency_deposits_status_idx" ON "agency_deposits"("deposit_status")`,
      `CREATE INDEX IF NOT EXISTS "agency_deposits_date_idx" ON "agency_deposits"("deposit_date")`,
      `CREATE INDEX IF NOT EXISTS "deposit_transactions_deposit_id_idx" ON "deposit_transactions"("deposit_id")`,
      `ALTER TABLE "agency_deposits" ADD CONSTRAINT "agency_deposits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "agency_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "agency_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "deposit_transactions" ADD CONSTRAINT "deposit_transactions_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
    ]) {
      await this.$executeRawUnsafe(sql).catch(() => {});
    }

    this.logger.log('Deposit tracking tables ready');
  }
}
