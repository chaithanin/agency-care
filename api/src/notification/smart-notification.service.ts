import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LineService } from './line.service';
import { randomUUID } from 'crypto';

const APP_URL = process.env.APP_URL ?? 'https://agency-care-1027220843311.asia-east2.run.app';

type NotifType = 'daily_brief' | 'midday' | 'afternoon' | 'evening';

@Injectable()
export class SmartNotificationService {
  private readonly logger = new Logger(SmartNotificationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private line: LineService,
  ) {}

  // ============================================================
  // Settings helpers
  // ============================================================

  async getSettings() {
    return this.prisma.notificationSetting.findMany({ orderBy: { notifType: 'asc' } });
  }

  async updateSetting(notifType: string, data: { isEnabled?: boolean; channelLine?: boolean; channelEmail?: boolean; cronTime?: string }) {
    return this.prisma.notificationSetting.update({ where: { notifType }, data });
  }

  private async isEnabled(notifType: NotifType): Promise<boolean> {
    const s = await this.prisma.notificationSetting.findUnique({ where: { notifType } });
    return s?.isEnabled ?? true;
  }

  // ============================================================
  // Log helper
  // ============================================================

  private async log(params: {
    notifType: NotifType;
    channel: string;
    recipientId: string;
    role: string;
    taskCount: number;
    overdueCount: number;
    messageBody: string;
    status: 'sent' | 'failed' | 'skipped';
    errorMsg?: string;
  }) {
    await this.prisma.notificationLog.create({
      data: {
        id: randomUUID(),
        notifType: params.notifType,
        channel: params.channel,
        recipientId: params.recipientId,
        role: params.role,
        taskCount: params.taskCount,
        overdueCount: params.overdueCount,
        messageBody: params.messageBody,
        status: params.status,
        sentAt: params.status === 'sent' ? new Date() : undefined,
        errorMsg: params.errorMsg,
      },
    });
  }

  async getLogs(filters: { notifType?: string; status?: string; from?: string; to?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (filters.notifType) where.notifType = filters.notifType;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59Z') } : {}),
      };
    }
    const logs = await this.prisma.notificationLog.findMany({
      where,
      include: { recipient: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 200,
    });
    return logs;
  }

  // ============================================================
  // 1. DAILY BRIEF — 08:00 (Sales + Team + Executive)
  // ============================================================

  @Cron('0 8 * * 1-6', { timeZone: 'Asia/Bangkok' })
  async runDailyBrief() {
    if (!(await this.isEnabled('daily_brief'))) return;
    this.logger.log('Smart Notification: Daily Brief 08:00');
    await this.sendDailyBrief();
  }

  async sendDailyBrief(dateStr?: string) {
    const today = this._today(dateStr);
    const tomorrow = new Date(today.getTime() + 86400000);

    const [salesEmployees, closers, executives] = await Promise.all([
      this.prisma.employee.findMany({
        where: { position: 'sales', isActive: true },
        select: { id: true, name: true, lineUserId: true, teamId: true, userId: true },
      }),
      this.prisma.employee.findMany({
        where: { position: 'closer', isActive: true },
        select: { id: true, name: true, lineUserId: true, teamId: true },
      }),
      this.prisma.user.findMany({
        where: { role: { in: ['admin', 'super_admin'] }, isActive: true },
        select: { id: true, employee: { select: { id: true, lineUserId: true, name: true } } },
      }),
    ]);

    const results = { sales: 0, closer: 0, exec: 0 };

    // --- Level 1: Sales ---
    for (const emp of salesEmployees) {
      const [todayPlans, overduePlans, donePlans] = await Promise.all([
        this.prisma.visitPlan.count({ where: { employeeId: emp.id, planDate: { gte: today, lt: tomorrow } } }),
        this.prisma.visitPlan.count({ where: { employeeId: emp.id, status: 'pending', planDate: { lt: today } } }),
        this.prisma.visitPlan.count({ where: { employeeId: emp.id, status: 'done', planDate: { gte: today, lt: tomorrow } } }),
      ]);

      const completionPct = todayPlans > 0 ? Math.round((donePlans / todayPlans) * 100) : 0;

      // AI: top 3 tasks by priority
      const topTasks = await this.prisma.visitPlan.findMany({
        where: { employeeId: emp.id, planDate: { gte: today, lt: tomorrow }, status: { not: 'done' } },
        include: { agency: { select: { name: true, phone: true } } },
        orderBy: { createdAt: 'asc' },
        take: 3,
      });

      const topTaskMapped = topTasks.map((t) => ({
        title: `Site Visit: ${t.agency.name}`,
        time: t.agency.phone ?? undefined,
      }));

      if (emp.lineUserId && this.line.enabled) {
        const bubble = this.line.buildAIDailyBubble({
          name: emp.name,
          todayCount: todayPlans,
          overdueCount: overduePlans,
          topTasks: topTaskMapped,
          appUrl: `${APP_URL}/my-day`,
        });
        const ok = await this.line.pushFlex(emp.lineUserId, `Daily Brief — คุณ${emp.name}`, { type: 'carousel', contents: [bubble] });
        await this.log({ notifType: 'daily_brief', channel: 'line', recipientId: emp.id, role: 'sales', taskCount: todayPlans, overdueCount: overduePlans, messageBody: `${todayPlans} tasks, ${overduePlans} overdue`, status: ok ? 'sent' : 'failed' });
        if (ok) results.sales++;
      }
    }

    // --- Level 2: Closer / Team ---
    for (const closer of closers) {
      if (!closer.teamId) continue;
      const teamMembers = salesEmployees.filter((e) => e.teamId === closer.teamId);
      if (!teamMembers.length) continue;

      const memberData = await Promise.all(
        teamMembers.map(async (m) => ({
          name: m.name,
          overdue: await this.prisma.visitPlan.count({ where: { employeeId: m.id, status: 'pending', planDate: { lt: today } } }),
        })),
      );
      const totalTasks = await this.prisma.visitPlan.count({ where: { employeeId: { in: teamMembers.map((m) => m.id) }, planDate: { gte: today, lt: tomorrow } } });
      const overdueTotal = memberData.reduce((s, m) => s + m.overdue, 0);
      const teams = await this.prisma.team.findMany({ where: { id: closer.teamId }, select: { name: true } });
      const teamName = teams[0]?.name ?? 'ทีม';

      if (closer.lineUserId && this.line.enabled) {
        const bubble = this.line.buildTeamBubble({ teamName, totalTasks, overdueTotal, members: memberData, appUrl: `${APP_URL}/team-dashboard` });
        const ok = await this.line.pushFlex(closer.lineUserId, `Team Daily Brief — ${teamName}`, { type: 'carousel', contents: [bubble] });
        await this.log({ notifType: 'daily_brief', channel: 'line', recipientId: closer.id, role: 'closer', taskCount: totalTasks, overdueCount: overdueTotal, messageBody: `Team ${teamName}: ${totalTasks} tasks, ${overdueTotal} overdue`, status: ok ? 'sent' : 'failed' });
        if (ok) results.closer++;
      }
    }

    // --- Level 3: Executive ---
    const allTeams = await this.prisma.team.findMany({ select: { id: true, name: true } });
    const [totalTasks, completed, overduePlans] = await Promise.all([
      this.prisma.visitPlan.count({ where: { planDate: { gte: today, lt: tomorrow } } }),
      this.prisma.visitPlan.count({ where: { planDate: { gte: today, lt: tomorrow }, status: 'done' } }),
      this.prisma.visitPlan.count({ where: { status: 'pending', planDate: { lt: today } } }),
    ]);
    const overdueEmployees = await this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { status: 'pending', planDate: { lt: today } } });
    const teamStats = await Promise.all(
      allTeams.map(async (t) => {
        const members = salesEmployees.filter((e) => e.teamId === t.id);
        const overdue = await this.prisma.visitPlan.count({ where: { employeeId: { in: members.map((m) => m.id) }, status: 'pending', planDate: { lt: today } } });
        return { name: t.name, overdue };
      }),
    );

    for (const exec of executives) {
      if (!exec.employee?.lineUserId || !this.line.enabled) continue;
      const bubble = this.line.buildExecutiveBubble({ totalTasks, completed, overdue: overduePlans, overdueEmployees: overdueEmployees.length, teams: teamStats.sort((a, b) => b.overdue - a.overdue), appUrl: `${APP_URL}/` });
      const ok = await this.line.pushFlex(exec.employee.lineUserId, 'Executive Daily Brief', { type: 'carousel', contents: [bubble] });
      if (exec.employee.id) {
        await this.log({ notifType: 'daily_brief', channel: 'line', recipientId: exec.employee.id, role: 'admin', taskCount: totalTasks, overdueCount: overduePlans, messageBody: `Org: ${totalTasks} tasks, ${overduePlans} overdue`, status: ok ? 'sent' : 'failed' });
      }
      if (ok) results.exec++;
    }

    this.logger.log(`Daily Brief: sales=${results.sales}, closer=${results.closer}, exec=${results.exec}`);
    return results;
  }

  // ============================================================
  // 2. MIDDAY REMINDER — 12:00
  // ============================================================

  @Cron('0 12 * * 1-6', { timeZone: 'Asia/Bangkok' })
  async runMidday() {
    if (!(await this.isEnabled('midday'))) return;
    this.logger.log('Smart Notification: Midday 12:00');
    await this.sendMidday();
  }

  async sendMidday(dateStr?: string) {
    const today = this._today(dateStr);
    const tomorrow = new Date(today.getTime() + 86400000);

    const salesEmployees = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });

    let sent = 0;
    for (const emp of salesEmployees) {
      const pending = await this.prisma.visitPlan.count({ where: { employeeId: emp.id, planDate: { gte: today, lt: tomorrow }, status: 'pending' } });
      if (pending === 0) continue; // skip those who have no pending

      if (emp.lineUserId && this.line.enabled) {
        const text = `⏰ แจ้งเตือนกลางวัน\nคุณ${emp.name}\nงานที่ยังไม่เสร็จ: ${pending} งาน\nโปรดดำเนินการก่อนสิ้นวัน\n👉 ${APP_URL}/my-day`;
        const ok = await this.line.pushText(emp.lineUserId, text);
        await this.log({ notifType: 'midday', channel: 'line', recipientId: emp.id, role: 'sales', taskCount: pending, overdueCount: 0, messageBody: text, status: ok ? 'sent' : 'failed' });
        if (ok) sent++;
      }
    }

    // Closer midday team summary
    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true, lineUserId: { not: null } },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });
    for (const closer of closers) {
      if (!closer.teamId) continue;
      const members = salesEmployees.filter((e) => e.teamId === closer.teamId);
      const memberPending = await Promise.all(
        members.map(async (m) => ({ name: m.name, pending: await this.prisma.visitPlan.count({ where: { employeeId: m.id, planDate: { gte: today, lt: tomorrow }, status: 'pending' } }) })),
      );
      const withWork = memberPending.filter((m) => m.pending > 0);
      if (!withWork.length) continue;
      const totalPending = withWork.reduce((s, m) => s + m.pending, 0);
      const lines = withWork.map((m) => `• ${m.name}: ${m.pending} งาน`).join('\n');
      const text = `📢 Team Midday Reminder\nงานค้างทั้งหมดในทีม: ${totalPending} งาน\n${lines}\n👉 ${APP_URL}/team-dashboard`;
      if (closer.lineUserId && this.line.enabled) {
        const ok = await this.line.pushText(closer.lineUserId, text);
        await this.log({ notifType: 'midday', channel: 'line', recipientId: closer.id, role: 'closer', taskCount: totalPending, overdueCount: 0, messageBody: text, status: ok ? 'sent' : 'failed' });
      }
    }

    return { sent };
  }

  // ============================================================
  // 3. AFTERNOON ESCALATION — 16:00 (Sale + Closer)
  // ============================================================

  @Cron('0 16 * * 1-6', { timeZone: 'Asia/Bangkok' })
  async runAfternoon() {
    if (!(await this.isEnabled('afternoon'))) return;
    this.logger.log('Smart Notification: Afternoon 16:00');
    await this.sendAfternoon();
  }

  async sendAfternoon(dateStr?: string) {
    const today = this._today(dateStr);
    const tomorrow = new Date(today.getTime() + 86400000);

    const salesEmployees = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });

    const escalatedSales: { id: string; name: string; teamId: string | null; pending: number }[] = [];

    for (const emp of salesEmployees) {
      const pending = await this.prisma.visitPlan.count({ where: { employeeId: emp.id, planDate: { gte: today, lt: tomorrow }, status: 'pending' } });
      if (pending === 0) continue;
      escalatedSales.push({ ...emp, pending });

      if (emp.lineUserId && this.line.enabled) {
        const text = `🔔 แจ้งเตือนก่อนเลิกงาน\nคุณ${emp.name}\nงานที่ยังไม่เสร็จ: ${pending} งาน\n⚠️ โปรดดำเนินการหรือรายงานความคืบหน้า\n👉 ${APP_URL}/my-day`;
        const ok = await this.line.pushText(emp.lineUserId, text);
        await this.log({ notifType: 'afternoon', channel: 'line', recipientId: emp.id, role: 'sales', taskCount: pending, overdueCount: 0, messageBody: text, status: ok ? 'sent' : 'failed' });
      }
    }

    // Also notify closers about their team's pending work
    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true, lineUserId: { not: null } },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });

    for (const closer of closers) {
      if (!closer.teamId) continue;
      const teamEscalated = escalatedSales.filter((e) => e.teamId === closer.teamId);
      if (!teamEscalated.length) continue;
      const total = teamEscalated.reduce((s, e) => s + e.pending, 0);
      const lines = teamEscalated.map((m) => `• ${m.name}: ${m.pending} งาน`).join('\n');
      const text = `⚠️ Afternoon Escalation\nทีมยังมีงานค้าง ${total} งาน:\n${lines}\n👉 ${APP_URL}/team-dashboard`;
      if (closer.lineUserId && this.line.enabled) {
        const ok = await this.line.pushText(closer.lineUserId, text);
        await this.log({ notifType: 'afternoon', channel: 'line', recipientId: closer.id, role: 'closer', taskCount: total, overdueCount: 0, messageBody: text, status: ok ? 'sent' : 'failed' });
      }
    }

    return { escalatedSales: escalatedSales.length };
  }

  // ============================================================
  // 4. EVENING ESCALATION — 18:00 (Sale + Closer + Executive)
  // ============================================================

  @Cron('0 18 * * 1-6', { timeZone: 'Asia/Bangkok' })
  async runEvening() {
    if (!(await this.isEnabled('evening'))) return;
    this.logger.log('Smart Notification: Evening 18:00');
    await this.sendEvening();
  }

  async sendEvening(dateStr?: string) {
    const today = this._today(dateStr);
    const tomorrow = new Date(today.getTime() + 86400000);

    const salesEmployees = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });

    const overdueByMember: { id: string; name: string; teamId: string | null; count: number }[] = [];

    // Sales: notify only those with still-pending tasks today (now overdue)
    for (const emp of salesEmployees) {
      const overdue = await this.prisma.visitPlan.count({ where: { employeeId: emp.id, planDate: { gte: today, lt: tomorrow }, status: 'pending' } });
      if (overdue === 0) continue;
      overdueByMember.push({ ...emp, count: overdue });

      if (emp.lineUserId && this.line.enabled) {
        const text = `🚨 งานเกินกำหนด\nคุณ${emp.name}\nงานที่ยังไม่ดำเนินการวันนี้: ${overdue} งาน\nกรุณาอัปเดตสถานะหรือติดต่อหัวหน้างาน\n👉 ${APP_URL}/my-day`;
        const ok = await this.line.pushText(emp.lineUserId, text);
        await this.log({ notifType: 'evening', channel: 'line', recipientId: emp.id, role: 'sales', taskCount: overdue, overdueCount: overdue, messageBody: text, status: ok ? 'sent' : 'failed' });
      }
    }

    // Closers: team evening escalation bubble
    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true, lineUserId: { not: null } },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });
    for (const closer of closers) {
      if (!closer.teamId) continue;
      const teamOverdue = overdueByMember.filter((e) => e.teamId === closer.teamId);
      if (!teamOverdue.length) continue;
      const total = teamOverdue.reduce((s, e) => s + e.count, 0);
      const teams = await this.prisma.team.findMany({ where: { id: closer.teamId }, select: { name: true } });
      const teamName = teams[0]?.name ?? 'ทีม';
      if (closer.lineUserId && this.line.enabled) {
        const bubble = this.line.buildTeamBubble({ teamName, totalTasks: total, overdueTotal: total, members: teamOverdue.map((m) => ({ name: m.name, overdue: m.count })), appUrl: `${APP_URL}/team-dashboard`, isEvening: true });
        const ok = await this.line.pushFlex(closer.lineUserId, `🚨 Evening Escalation — ${teamName}`, { type: 'carousel', contents: [bubble] });
        await this.log({ notifType: 'evening', channel: 'line', recipientId: closer.id, role: 'closer', taskCount: total, overdueCount: total, messageBody: `Team evening: ${total} overdue`, status: ok ? 'sent' : 'failed' });
      }
    }

    // Executive: org-level evening report
    const allTeams = await this.prisma.team.findMany({ select: { id: true, name: true } });
    const teamStats = allTeams.map((t) => {
      const members = overdueByMember.filter((e) => e.teamId === t.id);
      return { name: t.name, overdue: members.reduce((s, m) => s + m.count, 0) };
    });
    const totalOverdue = overdueByMember.reduce((s, m) => s + m.count, 0);

    const executives = await this.prisma.user.findMany({
      where: { role: { in: ['admin', 'super_admin'] }, isActive: true },
      select: { employee: { select: { id: true, lineUserId: true } } },
    });
    for (const exec of executives) {
      if (!exec.employee?.lineUserId || !this.line.enabled) continue;
      const bubble = this.line.buildExecutiveBubble({ totalTasks: totalOverdue, completed: 0, overdue: totalOverdue, overdueEmployees: overdueByMember.length, teams: teamStats.sort((a, b) => b.overdue - a.overdue), appUrl: `${APP_URL}/`, isEvening: true });
      const ok = await this.line.pushFlex(exec.employee.lineUserId, '🚨 Evening Executive Escalation', { type: 'carousel', contents: [bubble] });
      if (exec.employee.id) {
        await this.log({ notifType: 'evening', channel: 'line', recipientId: exec.employee.id, role: 'admin', taskCount: totalOverdue, overdueCount: totalOverdue, messageBody: `Org evening: ${totalOverdue} overdue, ${overdueByMember.length} employees`, status: ok ? 'sent' : 'failed' });
      }
    }

    return { overdueEmployees: overdueByMember.length, totalOverdue };
  }

  // ============================================================
  // Manual test trigger
  // ============================================================

  async sendTest(notifType: NotifType, dateStr?: string) {
    switch (notifType) {
      case 'daily_brief': return this.sendDailyBrief(dateStr);
      case 'midday': return this.sendMidday(dateStr);
      case 'afternoon': return this.sendAfternoon(dateStr);
      case 'evening': return this.sendEvening(dateStr);
    }
  }

  // ============================================================
  // LINE Account Link — employee binds LINE userId via LIFF
  // ============================================================

  async bindLine(employeeId: string, lineUserId: string) {
    return this.prisma.employee.update({ where: { id: employeeId }, data: { lineUserId } });
  }

  async unbindLine(employeeId: string) {
    return this.prisma.employee.update({ where: { id: employeeId }, data: { lineUserId: null } });
  }

  async markLogRead(logId: string) {
    return this.prisma.notificationLog.update({ where: { id: logId }, data: { status: 'read', readAt: new Date() } });
  }

  // ============================================================
  // PR Notifications — รวมอยู่ใน Daily Brief 08:00
  // + Escalation cron แยกต่างหาก (08:30)
  // ============================================================

  @Cron('30 8 * * 1-6', { timeZone: 'Asia/Bangkok' })
  async runPrEscalation() {
    this.logger.log('PR Escalation: 08:30');
    await this.sendPrNotifications();
  }

  async sendPrNotifications() {
    const prs = await this.prisma.purchaseRequest.findMany({
      where: { status: { in: ['submitted', 'waiting_approval', 'approved', 'purchasing', 'ordered', 'received'] } },
      include: {
        responsible: { select: { id: true, name: true, lineUserId: true, userId: true, teamId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const now = Date.now();
    const byEmployee = new Map<string, { emp: typeof prs[0]['responsible']; prs: typeof prs }>();
    for (const pr of prs) {
      if (!pr.responsible) continue;
      const key = pr.responsible.id;
      const entry = byEmployee.get(key) ?? { emp: pr.responsible, prs: [] };
      entry.prs.push(pr);
      byEmployee.set(key, entry);
    }

    let sent = 0;
    for (const { emp, prs: empPrs } of byEmployee.values()) {
      if (!emp?.lineUserId || !this.line.enabled) continue;
      const list = empPrs.slice(0, 5).map((p) => `• ${p.prNumber}`).join('\n');
      const more = empPrs.length > 5 ? `\n…และอีก ${empPrs.length - 5} รายการ` : '';
      const text = `📌 แจ้งเตือน PR\nคุณ${emp.name}\nคุณมี PR ที่ยังไม่ปิด จำนวน ${empPrs.length} รายการ\n${list}${more}\nกรุณาอัปเดตสถานะ\n👉 ${APP_URL}/pr`;
      const ok = await this.line.pushText(emp.lineUserId, text);
      if (emp.id) {
        await this.log({ notifType: 'daily_brief', channel: 'line', recipientId: emp.id, role: 'sales', taskCount: empPrs.length, overdueCount: 0, messageBody: text, status: ok ? 'sent' : 'failed' });
      }
      if (ok) sent++;
    }

    // Escalation — 7 days: notify closer too
    const sevenDaysAgo = new Date(now - 7 * 86400000);
    const fourteenDaysAgo = new Date(now - 14 * 86400000);

    const longOverduePrs = prs.filter((p) => p.createdAt < sevenDaysAgo);
    if (!longOverduePrs.length) return { sent };

    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true, lineUserId: { not: null } },
      select: { id: true, name: true, lineUserId: true, teamId: true },
    });

    // Group by team for closer
    const byTeam = new Map<string, { pr: typeof prs[0]; daysOpen: number }[]>();
    for (const pr of longOverduePrs) {
      if (!pr.responsible?.teamId) continue;
      const entry = byTeam.get(pr.responsible.teamId) ?? [];
      entry.push({ pr, daysOpen: Math.floor((now - pr.createdAt.getTime()) / 86400000) });
      byTeam.set(pr.responsible.teamId, entry);
    }

    for (const closer of closers) {
      if (!closer.teamId || !byTeam.has(closer.teamId)) continue;
      const items = byTeam.get(closer.teamId)!;
      const list = items.slice(0, 5).map((i) => `• ${i.pr.prNumber} (${i.daysOpen} วัน)`).join('\n');
      const text = `⚠️ PR ค้างในทีม\nทีม — มี ${items.length} PR ค้างเกิน 7 วัน\n${list}\n👉 ${APP_URL}/pr`;
      if (closer.lineUserId && this.line.enabled) await this.line.pushText(closer.lineUserId, text);
    }

    // 14-day escalation — notify executives
    const veryLongOverdue = prs.filter((p) => p.createdAt < fourteenDaysAgo);
    if (!veryLongOverdue.length) return { sent };

    const executives = await this.prisma.user.findMany({
      where: { role: { in: ['admin', 'super_admin'] }, isActive: true },
      select: { employee: { select: { id: true, lineUserId: true, name: true } } },
    });
    for (const exec of executives) {
      if (!exec.employee?.lineUserId || !this.line.enabled) continue;
      const text = `🚨 PR เกินกำหนด 14 วัน\nองค์กรมี ${veryLongOverdue.length} PR ค้างเกิน 2 สัปดาห์\n👉 ${APP_URL}/pr`;
      await this.line.pushText(exec.employee.lineUserId, text);
    }

    return { sent };
  }

  // Due date reminder — 3 days before (run at 08:15)
  @Cron('15 8 * * 1-6', { timeZone: 'Asia/Bangkok' })
  async runPrDueReminder() {
    const in3days = new Date(Date.now() + 3 * 86400000);
    const in3daysEnd = new Date(in3days.getTime() + 86400000);
    const upcoming = await this.prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['submitted', 'waiting_approval', 'approved', 'purchasing', 'ordered', 'received'] },
        dueDate: { gte: in3days, lt: in3daysEnd },
      },
      include: { responsible: { select: { id: true, name: true, lineUserId: true } } },
    });
    for (const pr of upcoming) {
      if (!pr.responsible?.lineUserId || !this.line.enabled) continue;
      const text = `⏳ PR ใกล้ถึงกำหนด\n${pr.prNumber}: ${pr.title}\nกำหนดส่ง: ${pr.dueDate?.toISOString().slice(0, 10)}\n👉 ${APP_URL}/pr/${pr.id}`;
      await this.line.pushText(pr.responsible.lineUserId, text);
    }
  }

  // ============================================================
  // Utils
  // ============================================================

  private _today(dateStr?: string): Date {
    const n = dateStr ? new Date(dateStr) : new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
}
