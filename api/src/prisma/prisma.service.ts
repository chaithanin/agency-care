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
  }
}
