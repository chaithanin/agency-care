import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get token(): string | undefined {
    return this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
  }

  // ส่ง push หา LINE user id ผ่าน Messaging API
  async pushMessage(to: string, text: string) {
    if (!this.token) throw new Error('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`LINE push ล้มเหลว (${res.status}): ${body}`);
    }
  }

  // แจ้งเตือนงานเข้าเยี่ยมที่ยังค้าง (pending) ถึงวันนี้ → push หาเซลส์ที่ผูก LINE
  async notifyPendingVisits(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const today = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));

    const plans = await this.prisma.visitPlan.findMany({
      where: { status: 'pending', planDate: { lte: today } },
      include: {
        agency: { select: { name: true } },
        employee: { select: { id: true, name: true, lineUserId: true } },
      },
    });

    // รวมตามเซลส์
    const byEmp = new Map<string, { name: string; lineUserId: string | null; agencies: string[] }>();
    for (const p of plans) {
      const e = byEmp.get(p.employee.id) ?? {
        name: p.employee.name,
        lineUserId: p.employee.lineUserId,
        agencies: [],
      };
      e.agencies.push(p.agency.name);
      byEmp.set(p.employee.id, e);
    }

    const results: { employee: string; count: number; sent: boolean; reason?: string }[] = [];
    for (const e of byEmp.values()) {
      if (!e.lineUserId) {
        results.push({ employee: e.name, count: e.agencies.length, sent: false, reason: 'ยังไม่ผูก LINE' });
        continue;
      }
      const list = e.agencies.slice(0, 10).map((a, i) => `${i + 1}. ${a}`).join('\n');
      const more = e.agencies.length > 10 ? `\n…และอีก ${e.agencies.length - 10} ร้าน` : '';
      const text = `🔔 แจ้งเตือนงานเข้าเยี่ยม\nคุณ ${e.name} มีงานค้าง ${e.agencies.length} ร้าน:\n${list}${more}`;
      try {
        await this.pushMessage(e.lineUserId, text);
        results.push({ employee: e.name, count: e.agencies.length, sent: true });
      } catch (err) {
        results.push({
          employee: e.name,
          count: e.agencies.length,
          sent: false,
          reason: (err as Error).message,
        });
      }
    }
    return { date: today.toISOString().slice(0, 10), totalEmployees: results.length, results };
  }

  // cron: ทุกวัน 08:00 (Asia/Bangkok) — เปิดด้วย NOTIFY_ENABLED=true
  @Cron('0 8 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyReminder() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    if (!this.token) return;
    try {
      const r = await this.notifyPendingVisits();
      this.logger.log(`แจ้งเตือนรายวัน: ส่ง ${r.results.filter((x) => x.sent).length}/${r.totalEmployees}`);
    } catch (e) {
      this.logger.error(`แจ้งเตือนรายวันล้มเหลว: ${(e as Error).message}`);
    }
  }
}
