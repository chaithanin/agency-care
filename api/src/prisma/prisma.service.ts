import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildUrl() {
  const url = process.env.DATABASE_URL ?? '';
  // Neon free tier caps connections at ~5; Cloud Run can have multiple instances.
  // Append connection_limit=1 so each instance stays within budget.
  if (url.includes('connection_limit')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=1&pool_timeout=15`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ datasources: { db: { url: buildUrl() } } });
  }

  async onModuleInit() {
    await this.$connect();
    await this.applyPendingMigrations();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Apply migrations that may not have run via prisma migrate deploy (Neon connection limit workaround)
  private async applyPendingMigrations() {
    try {
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

      // Indexes and foreign keys — ignore errors if already exist
      await this.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_recipients_broadcast_id_employee_id_key"
        ON "broadcast_recipients"("broadcast_id", "employee_id")
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "broadcasts_status_idx" ON "broadcasts"("status")
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_approved_by_id_fkey"
        FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_id_fkey"
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey"
        FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcast_templates" ADD CONSTRAINT "broadcast_templates_created_by_id_fkey"
        FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_broadcast_id_fkey"
        FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `).catch(() => {});

      await this.$executeRawUnsafe(`
        ALTER TABLE "broadcast_logs" ADD CONSTRAINT "broadcast_logs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `).catch(() => {});

      // Seed default templates if none exist
      const count = await this.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "broadcast_templates"
      `;
      if (Number(count[0].count) === 0) {
        const adminUser = await this.$queryRaw<{ id: string }[]>`
          SELECT id FROM "users" WHERE role = 'super_admin' LIMIT 1
        `;
        if (adminUser.length > 0) {
          const uid = adminUser[0].id;
          const templates = [
            ['ข่าวบริษัท', 'news', '📢 ข่าวบริษัท\n\n[หัวข้อ]\n\n[รายละเอียด]\n\n📅 วันที่: [วันที่]'],
            ['โปรโมชั่น', 'promotion', '🎁 โปรโมชั่นพิเศษ\n\n[ชื่อโปรโมชั่น]\n\n✅ [รายละเอียด]\n⏰ ถึงวันที่: [วันที่]'],
            ['แจ้งอบรม', 'training', '📚 แจ้งอบรม\n\n[ชื่อหลักสูตร]\n\n📅 วันที่: [วันที่]\n🕐 เวลา: [เวลา]\n📍 สถานที่: [สถานที่]'],
            ['แจ้งระบบปิด', 'it', '🔧 แจ้งปิดปรับปรุงระบบ\n\n⚠️ ระบบจะปิดให้บริการชั่วคราว\n\n📅 วันที่: [วันที่]\n🕐 เวลา: [เวลา] - [เวลา]'],
            ['แจ้งวันหยุด', 'hr', '🎌 แจ้งวันหยุด\n\n[ชื่อวันหยุด]\n\n📅 วันที่: [วันที่]'],
            ['แจ้งเหตุฉุกเฉิน', 'emergency', '🚨 แจ้งเหตุด่วน\n\n[รายละเอียด]\n\nกรุณาติดต่อกลับ: [เบอร์โทร]'],
          ];
          for (const [name, type, content] of templates) {
            await this.$executeRawUnsafe(
              `INSERT INTO "broadcast_templates" ("id","name","type","content","is_active","created_by_id","created_at","updated_at")
               VALUES (gen_random_uuid()::text, $1, $2, $3, true, $4, NOW(), NOW())
               ON CONFLICT DO NOTHING`,
              name, type, content, uid,
            );
          }
        }
      }

      this.logger.log('Broadcast tables ready');
    } catch (err) {
      this.logger.error(`Migration error (non-fatal): ${String(err)}`);
    }
  }
}
