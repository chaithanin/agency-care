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

  // ---- Email ----
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
    if (!m) { this.logger.warn('SMTP ไม่ได้ตั้งค่า — ข้ามอีเมล'); return false; }
    await m.sendMail({ from: this.config.get('MAIL_FROM', 'Agency Care <noreply@agencycare.local>'), to, subject, html });
    return true;
  }

  // ---- LINE push ----
  async pushMessage(to: string, text: string) {
    if (!this.token) throw new Error('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
    });
    if (!res.ok) throw new Error(`LINE push ล้มเหลว (${res.status}): ${await res.text()}`);
  }

  // ---- In-App Notification ----
  async createInApp(userId: string, title: string, body: string, type: string, link?: string) {
    return this.prisma.inAppNotification.create({ data: { userId, title, body, type, link } });
  }

  async getMyNotifications(userId: string, limit = 50) {
    return this.prisma.inAppNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.inAppNotification.count({ where: { userId, read: false } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    return this.prisma.inAppNotification.updateMany({ where: { id, userId }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.inAppNotification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  // ============================================================
  // Phase A-1: แจ้งเตือนล่วงหน้า 1 วัน (19:00)
  // ============================================================
  async notifyTomorrowSchedule(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const tomorrow = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
    const dayAfter  = new Date(tomorrow.getTime() + 86400000);

    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: { gte: tomorrow, lt: dayAfter }, status: 'pending' },
      include: {
        agency: { select: { name: true, ownerName: true, managerName: true } },
        employee: { select: { id: true, name: true, lineUserId: true, userId: true } },
      },
    });

    const byEmp = new Map<string, { name: string; lineUserId: string | null; userId: string | null; agencies: { name: string; contact: string | null }[] }>();
    for (const p of plans) {
      const e = byEmp.get(p.employee.id) ?? { name: p.employee.name, lineUserId: p.employee.lineUserId, userId: p.employee.userId, agencies: [] };
      e.agencies.push({ name: p.agency.name, contact: p.agency.managerName ?? p.agency.ownerName });
      byEmp.set(p.employee.id, e);
    }

    const tomorrowLabel = tomorrow.toISOString().slice(0, 10);
    const results: { employee: string; sent: boolean; reason?: string }[] = [];

    for (const e of byEmp.values()) {
      const list = e.agencies.map((a, i) => `${i + 1}. ${a.name}${a.contact ? ` (${a.contact})` : ''}`).join('\n');
      const text =
        `🔔 แจ้งเตือนล่วงหน้า — พรุ่งนี้ (${tomorrowLabel})\n` +
        `คุณ ${e.name} มีนัดเข้าเยี่ยม ${e.agencies.length} ร้าน\n${list}\n\n` +
        `สิ่งที่ต้องเตรียม:\n✅ สื่อการขาย\n✅ โมเดลสินค้า\n✅ โปรโมชั่น`;

      if (e.lineUserId && this.token) {
        try { await this.pushMessage(e.lineUserId, text); results.push({ employee: e.name, sent: true }); }
        catch (err) { results.push({ employee: e.name, sent: false, reason: (err as Error).message }); }
      } else {
        results.push({ employee: e.name, sent: false, reason: 'ยังไม่ผูก LINE' });
      }
      if (e.userId) {
        await this.createInApp(e.userId, `พรุ่งนี้มีนัด ${e.agencies.length} ร้าน`, e.agencies.map(a => a.name).join(', '), 'visit_reminder', '/my-day').catch(() => {});
      }
    }
    return { date: tomorrowLabel, results };
  }

  // ============================================================
  // Phase A-2: แจ้ง closer — ทีมใครยังไม่ Check-in (10:30)
  // ============================================================
  async notifyTeamNoCheckin(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const today    = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const tomorrow = new Date(today.getTime() + 86400000);

    const pendingPlans = await this.prisma.visitPlan.findMany({
      where: { planDate: { gte: today, lt: tomorrow }, checkin: null, status: 'pending' },
      include: {
        employee: { select: { id: true, name: true, teamId: true } },
        agency:   { select: { name: true } },
      },
    });

    const byTeam = new Map<string, { salesName: string; agencyName: string }[]>();
    for (const p of pendingPlans) {
      const tid = p.employee.teamId ?? 'none';
      const arr = byTeam.get(tid) ?? [];
      arr.push({ salesName: p.employee.name, agencyName: p.agency.name });
      byTeam.set(tid, arr);
    }

    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true, teamId: { in: [...byTeam.keys()].filter(k => k !== 'none') } },
      select: { id: true, name: true, teamId: true, lineUserId: true, userId: true },
    });

    const dateLabel = today.toISOString().slice(0, 10);
    const results: { closer: string; sent: boolean; reason?: string }[] = [];

    for (const closer of closers) {
      const items = byTeam.get(closer.teamId ?? '');
      if (!items?.length) continue;

      const bySales = new Map<string, string[]>();
      for (const item of items) {
        const a = bySales.get(item.salesName) ?? [];
        a.push(item.agencyName);
        bySales.set(item.salesName, a);
      }

      const lines = [...bySales.entries()]
        .map(([name, agencies]) => `• ${name}: ${agencies.slice(0, 3).join(', ')}${agencies.length > 3 ? ` +${agencies.length - 3}` : ''}`)
        .join('\n');
      const text = `🔔 แจ้งเตือนทีม — ${dateLabel}\n${bySales.size} คนยังไม่ได้ Check-in\n${lines}`;

      if (closer.lineUserId && this.token) {
        try { await this.pushMessage(closer.lineUserId, text); results.push({ closer: closer.name, sent: true }); }
        catch (err) { results.push({ closer: closer.name, sent: false, reason: (err as Error).message }); }
      } else {
        results.push({ closer: closer.name, sent: false, reason: 'ยังไม่ผูก LINE' });
      }
      if (closer.userId) {
        await this.createInApp(closer.userId, `${bySales.size} คนยังไม่ Check-in`, [...bySales.keys()].join(', '), 'overdue_checkin', '/plans').catch(() => {});
      }
    }
    return { date: dateLabel, closersNotified: results.length, results };
  }

  // ============================================================
  // Phase A-3: แจ้ง closer — แผนงานน้อยกว่าเป้า (ต้นเดือน)
  // ============================================================
  async notifyLowPlanCount(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const year = n.getUTCFullYear();
    const month = n.getUTCMonth() + 1;
    const MIN_VISITS = 12;

    const monthlyPlans = await this.prisma.monthlyPlan.findMany({ where: { year, month }, select: { employeeId: true, visitTarget: true } });
    const targetMap = new Map(monthlyPlans.map(p => [p.employeeId, p.visitTarget]));

    const mStart = new Date(Date.UTC(year, month - 1, 1));
    const mEnd   = new Date(Date.UTC(year, month, 1));
    const planCounts = await this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { planDate: { gte: mStart, lt: mEnd } }, _count: { _all: true } });
    const countMap = new Map(planCounts.map(p => [p.employeeId, p._count._all]));

    const sales = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      select: { id: true, name: true, teamId: true, userId: true },
    });

    const byTeam = new Map<string, { name: string; planned: number; target: number }[]>();
    for (const s of sales) {
      const planned = countMap.get(s.id) ?? 0;
      const target  = targetMap.get(s.id) ?? MIN_VISITS;
      if (planned >= target) continue;
      const tid = s.teamId ?? 'none';
      const arr = byTeam.get(tid) ?? [];
      arr.push({ name: s.name, planned, target });
      byTeam.set(tid, arr);
    }

    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true, teamId: { in: [...byTeam.keys()].filter(k => k !== 'none') } },
      select: { id: true, name: true, teamId: true, lineUserId: true, userId: true },
    });

    const results: { closer: string; sent: boolean }[] = [];
    for (const closer of closers) {
      const members = byTeam.get(closer.teamId ?? '');
      if (!members?.length) continue;
      const lines = members.map(m => `• ${m.name}: ${m.planned}/${m.target} ครั้ง`).join('\n');
      const text = `📋 แผนงานไม่ครบเป้า (${year}/${String(month).padStart(2, '0')})\n${lines}`;
      if (closer.lineUserId && this.token) {
        try { await this.pushMessage(closer.lineUserId, text); results.push({ closer: closer.name, sent: true }); }
        catch { results.push({ closer: closer.name, sent: false }); }
      }
      if (closer.userId) {
        await this.createInApp(closer.userId, 'แผนงานทีมไม่ครบเป้า', lines, 'team_summary', '/kpi').catch(() => {});
      }
    }
    return { results };
  }

  // ============================================================
  // สรุปงานประจำวัน (admin + closer)
  // ============================================================
  async dailyAdminSummary(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const day     = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const nextDay = new Date(day.getTime() + 86400000);
    const mGte    = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
    const mLt     = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1));

    const [plannedToday, doneToday, activeNow, monthDone, noCheckin, items, doneByEmp, plannedByEmp, emps, admins] =
      await Promise.all([
        this.prisma.visitPlan.count({ where: { planDate: { gte: day, lt: nextDay } } }),
        this.prisma.visitPlan.count({ where: { planDate: { gte: day, lt: nextDay }, status: 'done' } }),
        this.prisma.visitCheckin.count({ where: { checkinAt: { gte: day }, checkOutAt: null } }),
        this.prisma.visitPlan.count({ where: { status: 'done', planDate: { gte: mGte, lt: mLt } } }),
        this.prisma.visitPlan.count({ where: { planDate: { gte: day, lt: nextDay }, status: 'pending', checkin: null } }),
        this.prisma.posmItem.findMany({ where: { isActive: true } }),
        this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { planDate: { gte: day, lt: nextDay }, status: 'done' }, _count: { _all: true } }),
        this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { planDate: { gte: day, lt: nextDay } }, _count: { _all: true } }),
        this.prisma.employee.findMany({ where: { position: { in: ['sales', 'closer'] }, isActive: true }, select: { id: true, name: true } }),
        this.prisma.user.findMany({ where: { role: { in: ['admin', 'closer'] }, isActive: true }, select: { id: true, email: true, employee: { select: { lineUserId: true } } } }),
      ]);

    const lowStock = items.filter(i => i.reorderPoint > 0 && i.stockQty <= i.reorderPoint);
    const dMap = new Map(doneByEmp.map(d => [d.employeeId, d._count._all]));
    const pMap = new Map(plannedByEmp.map(d => [d.employeeId, d._count._all]));
    const lines = emps.map(e => `• ${e.name}: ${dMap.get(e.id) ?? 0}/${pMap.get(e.id) ?? 0}`).join('\n');
    const dateLabel = day.toISOString().slice(0, 10);
    let overdueTasks = 0;
    try { overdueTasks = await this.prisma.task.count({ where: { status: 'overdue' } }); } catch { /* table may not exist yet */ }

    const text =
      `📊 สรุปงานประจำวัน ${dateLabel}\n` +
      `เยี่ยมวันนี้: ${doneToday}/${plannedToday} · กำลังอยู่หน้างาน ${activeNow}\n` +
      `ไม่ได้ Check-in: ${noCheckin} · งาน Overdue: ${overdueTasks}\n` +
      `เยี่ยมสะสมเดือนนี้: ${monthDone} · สต็อกต่ำ: ${lowStock.length}\n\nรายคน:\n${lines}`;
    const html = `<h3>สรุปงานประจำวัน ${dateLabel}</h3><p>เยี่ยมวันนี้: <b>${doneToday}/${plannedToday}</b> · ขาด Check-in: <b>${noCheckin}</b> · Overdue: <b>${overdueTasks}</b></p><pre>${lines}</pre>`;

    const res = { date: dateLabel, line: 0, email: 0, inApp: 0 };
    for (const a of admins) {
      if (a.employee?.lineUserId && this.token) {
        try { await this.pushMessage(a.employee.lineUserId, text); res.line++; } catch { /* skip */ }
      }
      await this.createInApp(a.id, `สรุปวัน ${dateLabel}: เยี่ยม ${doneToday}/${plannedToday}`, `ขาด Check-in ${noCheckin} · Overdue ${overdueTasks}`, 'org_summary', '/').catch(() => {});
      res.inApp++;
    }
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    const emails = adminEmail ? adminEmail.split(',').map(e => e.trim()) : admins.map(a => a.email);
    for (const to of emails) {
      try { if (await this.sendEmail(to, `สรุปงานประจำวัน ${dateLabel}`, html)) res.email++; } catch (e) { this.logger.warn(`email: ${(e as Error).message}`); }
    }
    return { ...res, summary: text };
  }

  async notifyPendingVisits(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const today = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const plans = await this.prisma.visitPlan.findMany({
      where: { status: 'pending', planDate: { lte: today } },
      include: {
        agency:   { select: { name: true } },
        employee: { select: { id: true, name: true, lineUserId: true } },
      },
    });
    const byEmp = new Map<string, { name: string; lineUserId: string | null; agencies: string[] }>();
    for (const p of plans) {
      const e = byEmp.get(p.employee.id) ?? { name: p.employee.name, lineUserId: p.employee.lineUserId, agencies: [] };
      e.agencies.push(p.agency.name);
      byEmp.set(p.employee.id, e);
    }
    const results: { employee: string; count: number; sent: boolean; reason?: string }[] = [];
    for (const e of byEmp.values()) {
      if (!e.lineUserId) { results.push({ employee: e.name, count: e.agencies.length, sent: false, reason: 'ยังไม่ผูก LINE' }); continue; }
      const list = e.agencies.slice(0, 10).map((a, i) => `${i + 1}. ${a}`).join('\n');
      const more = e.agencies.length > 10 ? `\n…และอีก ${e.agencies.length - 10} ร้าน` : '';
      const text = `🔔 แจ้งเตือนงานเข้าเยี่ยม\nคุณ ${e.name} มีงานค้าง ${e.agencies.length} ร้าน:\n${list}${more}`;
      try { await this.pushMessage(e.lineUserId, text); results.push({ employee: e.name, count: e.agencies.length, sent: true }); }
      catch (err) { results.push({ employee: e.name, count: e.agencies.length, sent: false, reason: (err as Error).message }); }
    }
    return { date: today.toISOString().slice(0, 10), totalEmployees: results.length, results };
  }

  async notifyDailySchedule(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: date },
      include: {
        agency:   { select: { name: true } },
        employee: { select: { id: true, name: true, lineUserId: true, userId: true } },
      },
    });
    const byEmp = new Map<string, { name: string; lineUserId: string | null; userId: string | null; agencies: string[] }>();
    for (const p of plans) {
      const e = byEmp.get(p.employee.id) ?? { name: p.employee.name, lineUserId: p.employee.lineUserId, userId: p.employee.userId, agencies: [] };
      e.agencies.push(p.agency.name);
      byEmp.set(p.employee.id, e);
    }
    const results: { employee: string; sent: boolean; reason?: string }[] = [];
    for (const e of byEmp.values()) {
      const lines = e.agencies.map((a, i) => `${i + 1}. ${a}`).join('\n');
      const text = `📅 วันนี้มี ${e.agencies.length} นัดหมาย (${date.toISOString().slice(0, 10)})\nคุณ ${e.name}\n${lines}\n\nอย่าลืม Check-in หน้างานนะครับ`;
      if (e.lineUserId && this.token) {
        try { await this.pushMessage(e.lineUserId, text); results.push({ employee: e.name, sent: true }); }
        catch (err) { results.push({ employee: e.name, sent: false, reason: (err as Error).message }); }
      } else { results.push({ employee: e.name, sent: false, reason: 'ยังไม่ผูก LINE' }); }
      if (e.userId) {
        await this.createInApp(e.userId, `วันนี้มี ${e.agencies.length} นัด`, e.agencies.slice(0, 5).join(', '), 'visit_reminder', '/my-day').catch(() => {});
      }
    }
    return { date: date.toISOString().slice(0, 10), total: results.length, results };
  }

  // ============================================================
  // Cron jobs
  // ============================================================

  @Cron('0 8 * * *', { timeZone: 'Asia/Bangkok' })
  async dailyReminder() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    if (!this.token) return;
    try {
      const sched = await this.notifyDailySchedule();
      const r     = await this.notifyPendingVisits();
      this.logger.log(`08:00: ตาราง ${sched.results.filter(x => x.sent).length}/${sched.total} · ค้าง ${r.results.filter(x => x.sent).length}/${r.totalEmployees}`);
    } catch (e) { this.logger.error(`08:00: ${(e as Error).message}`); }
  }

  @Cron('30 10 * * *', { timeZone: 'Asia/Bangkok' })
  async teamCheckinCron() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    try {
      const r = await this.notifyTeamNoCheckin();
      this.logger.log(`10:30 no-checkin: ${r.closersNotified} closers`);
    } catch (e) { this.logger.error(`10:30: ${(e as Error).message}`); }
  }

  @Cron('0 18 * * *', { timeZone: 'Asia/Bangkok' })
  async dailySummaryCron() {
    if (this.config.get('DAILY_SUMMARY_ENABLED') !== 'true') return;
    try {
      const r = await this.dailyAdminSummary();
      this.logger.log(`18:00 สรุป: LINE ${r.line} · email ${r.email} · in-app ${r.inApp}`);
    } catch (e) { this.logger.error(`18:00: ${(e as Error).message}`); }
  }

  @Cron('0 19 * * *', { timeZone: 'Asia/Bangkok' })
  async tomorrowReminderCron() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    try {
      const r = await this.notifyTomorrowSchedule();
      this.logger.log(`19:00 พรุ่งนี้: ${r.results.filter(x => x.sent).length}/${r.results.length}`);
    } catch (e) { this.logger.error(`19:00: ${(e as Error).message}`); }
  }

  @Cron('0 9 2 * *', { timeZone: 'Asia/Bangkok' })
  async lowPlanCron() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    try { await this.notifyLowPlanCount(); } catch (e) { this.logger.error(`low-plan: ${(e as Error).message}`); }
  }
}
