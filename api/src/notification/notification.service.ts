import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private mailer?: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get token(): string | undefined {
    return this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
  }

  // ---- Email (nodemailer SMTP) ----
  private getMailer(): nodemailer.Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;
    if (!this.mailer) {
      this.mailer = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') },
      });
    }
    return this.mailer;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const m = this.getMailer();
    if (!m) {
      this.logger.warn('SMTP ไม่ได้ตั้งค่า — ข้ามอีเมล');
      return false;
    }
    await m.sendMail({
      from: this.config.get('MAIL_FROM', 'Agency Care <noreply@agencycare.local>'),
      to,
      subject,
      html,
    });
    return true;
  }

  // ---- สรุปงานประจำวัน → LINE + Email ผู้ดูแล ----
  async dailyAdminSummary(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const day = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const nextDay = new Date(day.getTime() + 86400000);
    const mGte = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
    const mLt = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));

    const [plannedToday, doneToday, activeNow, monthDone, items, doneByEmp, plannedByEmp, emps, admins] =
      await Promise.all([
        this.prisma.visitPlan.count({ where: { planDate: { gte: day, lt: nextDay } } }),
        this.prisma.visitPlan.count({ where: { planDate: { gte: day, lt: nextDay }, status: 'done' } }),
        this.prisma.visitCheckin.count({ where: { checkinAt: { gte: day }, checkOutAt: null } }),
        this.prisma.visitPlan.count({ where: { status: 'done', planDate: { gte: mGte, lt: mLt } } }),
        this.prisma.posmItem.findMany({ where: { isActive: true } }),
        this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { planDate: { gte: day, lt: nextDay }, status: 'done' }, _count: { _all: true } }),
        this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { planDate: { gte: day, lt: nextDay } }, _count: { _all: true } }),
        this.prisma.employee.findMany({ where: { position: { in: ['sales', 'closer'] }, isActive: true }, select: { id: true, name: true } }),
        this.prisma.user.findMany({ where: { role: { in: ['admin', 'manager'] }, isActive: true }, select: { email: true, employee: { select: { lineUserId: true } } } }),
      ]);
    const lowStock = items.filter((i) => i.reorderPoint > 0 && i.stockQty <= i.reorderPoint);
    const dMap = new Map(doneByEmp.map((d) => [d.employeeId, d._count._all]));
    const pMap = new Map(plannedByEmp.map((d) => [d.employeeId, d._count._all]));
    const lines = emps.map((e) => `• ${e.name}: ${dMap.get(e.id) || 0}/${pMap.get(e.id) || 0}`).join('\n');
    const dateLabel = day.toISOString().slice(0, 10);
    const text =
      `📊 สรุปงานประจำวัน ${dateLabel}\n` +
      `เยี่ยมวันนี้: ${doneToday}/${plannedToday} · กำลังอยู่หน้างาน ${activeNow}\n` +
      `เยี่ยมสะสมเดือนนี้: ${monthDone}\n` +
      `สื่อสต็อกต่ำ: ${lowStock.length} รายการ\n\nรายคน (เยี่ยม/แผน):\n${lines}`;
    const html = `<h3>สรุปงานประจำวัน ${dateLabel}</h3><p>เยี่ยมวันนี้: <b>${doneToday}/${plannedToday}</b> · กำลังอยู่หน้างาน ${activeNow}<br/>เยี่ยมสะสมเดือนนี้: <b>${monthDone}</b><br/>สื่อสต็อกต่ำ: <b>${lowStock.length}</b> รายการ</p><h4>รายคน (เยี่ยม/แผน)</h4><pre>${lines}</pre>`;

    const res = { date: dateLabel, line: 0, email: 0 };
    for (const a of admins) {
      if (a.employee?.lineUserId && this.token) {
        try { await this.pushMessage(a.employee.lineUserId, text); res.line++; } catch { /* skip */ }
      }
    }
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const emails = adminEmail ? adminEmail.split(',').map((e) => e.trim()) : admins.map((a) => a.email);
    for (const to of emails) {
      try { if (await this.sendEmail(to, `สรุปงานประจำวัน ${dateLabel}`, html)) res.email++; } catch (e) { this.logger.warn(`email fail: ${(e as Error).message}`); }
    }
    return { ...res, summary: text };
  }

  // cron: ทุกวัน 18:00 — เปิดด้วย DAILY_SUMMARY_ENABLED=true
  @Cron('0 18 * * *', { timeZone: 'Asia/Bangkok' })
  async dailySummaryCron() {
    if (this.config.get('DAILY_SUMMARY_ENABLED') !== 'true') return;
    try {
      const r = await this.dailyAdminSummary();
      this.logger.log(`สรุปรายวัน: LINE ${r.line} · email ${r.email}`);
    } catch (e) {
      this.logger.error(`สรุปรายวันล้มเหลว: ${(e as Error).message}`);
    }
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

  // Phase 5: push ตารางเยี่ยมวันนี้ (VisitPlan) ให้พนักงานแต่ละคน (ผ่าน LINE)
  async notifyDailySchedule(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: date },
      include: {
        agency: { select: { name: true } },
        employee: { select: { id: true, name: true, lineUserId: true } },
      },
    });
    const byEmp = new Map<string, { name: string; lineUserId: string | null; agencies: string[] }>();
    for (const p of plans) {
      const e = byEmp.get(p.employee.id) ?? { name: p.employee.name, lineUserId: p.employee.lineUserId, agencies: [] };
      e.agencies.push(p.agency.name);
      byEmp.set(p.employee.id, e);
    }
    const results: { employee: string; sent: boolean; reason?: string }[] = [];
    for (const e of byEmp.values()) {
      if (!e.lineUserId) {
        results.push({ employee: e.name, sent: false, reason: 'ยังไม่ผูก LINE' });
        continue;
      }
      const lines = e.agencies.map((a, i) => `${i + 1}. ${a}`).join('\n');
      const text = `📅 วันนี้มี ${e.agencies.length} นัดหมาย (${date.toISOString().slice(0, 10)})\nคุณ ${e.name}\n${lines}\n\nอย่าลืม Check-in หน้างานนะครับ`;
      try {
        await this.pushMessage(e.lineUserId, text);
        results.push({ employee: e.name, sent: true });
      } catch (err) {
        results.push({ employee: e.name, sent: false, reason: (err as Error).message });
      }
    }
    return { date: date.toISOString().slice(0, 10), total: results.length, results };
  }

  // cron: ทุกวัน 08:00 (Asia/Bangkok) — เปิดด้วย NOTIFY_ENABLED=true
  @Cron('0 8 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyReminder() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    if (!this.token) return;
    try {
      const sched = await this.notifyDailySchedule();
      const r = await this.notifyPendingVisits();
      this.logger.log(
        `แจ้งเตือน 08:00: ตารางวัน ${sched.results.filter((x) => x.sent).length}/${sched.total} · งานค้าง ${r.results.filter((x) => x.sent).length}/${r.totalEmployees}`,
      );
    } catch (e) {
      this.logger.error(`แจ้งเตือนรายวันล้มเหลว: ${(e as Error).message}`);
    }
  }
}
