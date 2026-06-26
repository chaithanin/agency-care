import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';

const ACT_LABEL: Record<string, string> = {
  visit_agency: 'Visit Agency Office',
  agency_brings_client: 'AG Bring Customer',
  training: 'Internal Training',
  other: 'Other',
};


@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  private async roleFilter(user: RequestUser): Promise<{ employeeId?: string }> {
    if (user.activeRole === 'sales') {
      const emp = await this.prisma.employee.findFirst({ where: { userId: user.id } });
      return emp ? { employeeId: emp.id } : { employeeId: 'NONE' };
    }
    return {};
  }

  // ── Report 1: Weekly Activity Summary ──────────────────────────────────────
  async weeklyActivity(user: RequestUser, from: string, to: string) {
    const rf = await this.roleFilter(user);
    const plans = await this.prisma.visitPlan.findMany({
      where: {
        planDate: { gte: new Date(from), lte: new Date(to) },
        ...rf,
      },
      include: {
        employee: { select: { id: true, code: true, name: true } },
        report: { select: { visitType: true, purposes: true, newLeads: true } },
        checkin: { select: { id: true } },
      },
    });

    type EmpRow = {
      id: string; code: string; name: string;
      visit_agency: number; agency_brings_client: number;
      training: number; other: number;
      total: number; completed: number; withReport: number; leads: number;
    };

    const empMap = new Map<string, EmpRow>();

    for (const p of plans) {
      const e = p.employee;
      if (!empMap.has(e.id)) {
        empMap.set(e.id, {
          id: e.id, code: e.code, name: e.name,
          visit_agency: 0, agency_brings_client: 0, training: 0, other: 0,
          total: 0, completed: 0, withReport: 0, leads: 0,
        });
      }
      const row = empMap.get(e.id)!;
      row.total++;

      if (p.status === 'done') row.completed++;
      if (p.report) {
        row.withReport++;
        row.leads += p.report.newLeads ?? 0;
      }

      // Activity type classification
      const vt = p.report?.visitType;
      if (vt === 'agency_brings_client') {
        row.agency_brings_client++;
      } else if (vt === 'visit_agency') {
        row.visit_agency++;
      } else {
        // Check purposes for training
        const hasTrain = (p.report?.purposes ?? []).includes('training');
        if (hasTrain) row.training++;
        else row.other++;
      }
    }

    // Task activity breakdown for the period
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'done',
        doneAt: { gte: new Date(from), lte: new Date(to) },
        ...(rf.employeeId ? { assignedToId: rf.employeeId } : {}),
      },
      select: { assignedToId: true, tag: true },
    });
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: 'overdue',
        dueDate: { gte: new Date(from), lte: new Date(to) },
        ...(rf.employeeId ? { assignedToId: rf.employeeId } : {}),
      },
      select: { assignedToId: true },
    });

    const taskCounts = new Map<string, { call: number; orientation: number; customer: number; holding: number; followupCustomer: number; overdue: number }>();
    const emptyTaskCounts = () => ({ call: 0, orientation: 0, customer: 0, holding: 0, followupCustomer: 0, overdue: 0 });
    for (const tk of tasks) {
      if (!taskCounts.has(tk.assignedToId)) taskCounts.set(tk.assignedToId, emptyTaskCounts());
      const c = taskCounts.get(tk.assignedToId)!;
      if (tk.tag === 'call') c.call++;
      else if (tk.tag === 'orientation') c.orientation++;
      else if (tk.tag === 'customer') c.customer++;
      else if (tk.tag === 'followup_hold') c.holding++;
      else if (tk.tag === 'followup') c.followupCustomer++;
    }
    for (const tk of overdueTasks) {
      if (!taskCounts.has(tk.assignedToId)) taskCounts.set(tk.assignedToId, emptyTaskCounts());
      taskCounts.get(tk.assignedToId)!.overdue++;
    }

    const rows = [...empMap.values()].map((r) => ({
      ...r,
      ...(taskCounts.get(r.id) ?? emptyTaskCounts()),
    })).sort((a, b) => b.total - a.total);

    const grand = rows.reduce(
      (acc, r) => ({
        visit_agency: acc.visit_agency + r.visit_agency,
        agency_brings_client: acc.agency_brings_client + r.agency_brings_client,
        training: acc.training + r.training,
        other: acc.other + r.other,
        total: acc.total + r.total,
        completed: acc.completed + r.completed,
        withReport: acc.withReport + r.withReport,
        leads: acc.leads + r.leads,
        call: acc.call + r.call,
        orientation: acc.orientation + r.orientation,
        customer: acc.customer + r.customer,
        holding: acc.holding + r.holding,
        followupCustomer: acc.followupCustomer + r.followupCustomer,
        overdue: acc.overdue + r.overdue,
      }),
      { visit_agency: 0, agency_brings_client: 0, training: 0, other: 0, total: 0, completed: 0, withReport: 0, leads: 0, call: 0, orientation: 0, customer: 0, holding: 0, followupCustomer: 0, overdue: 0 },
    );

    return { from, to, rows, grand, actLabels: ACT_LABEL };
  }

  // ── Report 2: Monthly Submission Log ───────────────────────────────────────
  async monthlySubmission(user: RequestUser, year: number, month: number) {
    const rf = await this.roleFilter(user);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // last day of month

    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: { gte: start, lte: end }, ...rf },
      include: {
        employee: { select: { id: true, code: true, name: true } },
        report: { select: { id: true, newLeads: true, createdAt: true } },
        checkin: { select: { id: true } },
      },
      orderBy: { planDate: 'asc' },
    });

    type EmpSub = {
      id: string; code: string; name: string;
      planned: number; completed: number; withReport: number; leads: number;
      submissionRate: number;
      dailyLog: { date: string; planned: number; completed: number; submitted: boolean; leads: number }[];
    };

    const empMap = new Map<string, EmpSub>();

    for (const p of plans) {
      const e = p.employee;
      if (!empMap.has(e.id)) {
        empMap.set(e.id, {
          id: e.id, code: e.code, name: e.name,
          planned: 0, completed: 0, withReport: 0, leads: 0,
          submissionRate: 0, dailyLog: [],
        });
      }
      const row = empMap.get(e.id)!;
      row.planned++;
      if (p.status === 'done') row.completed++;
      if (p.report) { row.withReport++; row.leads += p.report.newLeads ?? 0; }

      const dateStr = p.planDate.toISOString().slice(0, 10);
      let day = row.dailyLog.find((d) => d.date === dateStr);
      if (!day) { day = { date: dateStr, planned: 0, completed: 0, submitted: false, leads: 0 }; row.dailyLog.push(day); }
      day.planned++;
      if (p.status === 'done') day.completed++;
      if (p.report) { day.submitted = true; day.leads += p.report.newLeads ?? 0; }
    }

    const rows = [...empMap.values()].map((r) => ({
      ...r,
      submissionRate: r.completed > 0 ? Math.round((r.withReport / r.completed) * 100) : 0,
    }));

    return { year, month, rows };
  }

  // ── Report 4: Agency Activity Report (per-agency comprehensive summary) ───
  async agencyActivity(from: string, to: string, employeeId?: string) {
    const agencies = await this.prisma.agency.findMany({
      where: employeeId ? { assignments: { some: { employeeId } } } : {},
      include: {
        assignments: {
          include: { employee: { select: { name: true, code: true } } },
          orderBy: { assignedAt: 'asc' },
          take: 5,
        },
        visitPlans: {
          where: { planDate: { gte: new Date(from), lte: new Date(to) } },
          include: {
            employee: { select: { name: true } },
            report: { select: { visitType: true, newLeads: true, interestLevel: true, createdAt: true } },
          },
          orderBy: { planDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // POSM totals per agency
    const posmRows = await this.prisma.posmTransaction.findMany({
      where: { createdAt: { gte: new Date(from), lte: new Date(to) } },
      include: {
        posmItem: { select: { name: true, unit: true } },
        visitPlan: { select: { agencyId: true } },
      },
    });
    const posmByAgency = new Map<string, { name: string; qty: number; unit: string }[]>();
    for (const t of posmRows) {
      const aid = t.visitPlan.agencyId;
      if (!posmByAgency.has(aid)) posmByAgency.set(aid, []);
      const list = posmByAgency.get(aid)!;
      const existing = list.find((x) => x.name === t.posmItem.name);
      if (existing) existing.qty += t.quantity;
      else list.push({ name: t.posmItem.name, qty: t.quantity, unit: t.posmItem.unit });
    }

    return agencies.map((a) => {
      const profile = (a.profileData ?? {}) as Record<string, unknown>;
      const completed = a.visitPlans.filter((p) => p.status === 'done');
      const lastPlan = a.visitPlans[0];
      const leads = completed.reduce((s, p) => s + (p.report?.newLeads ?? 0), 0);
      const lastReportPlan = completed.find((p) => p.report);
      const lastReportDate = lastReportPlan?.report?.createdAt?.toISOString().slice(0, 10) ?? null;
      const materials = posmByAgency.get(a.id) ?? [];

      return {
        id: a.id, code: a.code, name: a.name, zone: a.zone, province: a.province,
        grade: a.gradeRelationship,
        assignedTo: a.assignments.map((as) => as.employee.name).join(', '),
        // Contact
        phone: a.phone, email: a.email,
        contactPerson: a.ownerName ?? a.managerName,
        staffCount: profile.staffCount ?? null,
        // Visit stats
        totalVisits: a.visitPlans.length,
        completedVisits: completed.length,
        lastVisitDate: lastPlan?.planDate?.toISOString().slice(0, 10) ?? null,
        lastVisitBy: lastPlan?.employee?.name ?? null,
        lastReportDate,
        leads,
        // From profileData (Agency Info Form)
        bringCustomers: (profile.bringCustomers as string) ?? '',
        lastSaleDate: (profile.lastSaleDate as string) ?? '',
        hadOrientation: (profile.hadOrientation as string) ?? '',
        hasOrganicSocial: (profile.hasOrganicSocial as string) ?? '',
        hasPaidSocial: (profile.hasPaidSocial as string) ?? '',
        organicPlatforms: profile.organicPlatforms ?? null,
        paidPlatforms: profile.paidPlatforms ?? null,
        websiteUrl: a.website ?? '',
        socialProjects: (profile.socialProjects as string[]) ?? [],
        // Materials
        materials,
        totalMaterials: materials.reduce((s, m) => s + m.qty, 0),
        // Remarks
        remark: a.remark ?? '',
      };
    });
  }

  // ── Report 5: Daily Visit Tracker (Employee × Day matrix) ─────────────────
  async dailyTracker(year: number, month: number, half: 1 | 2) {
    const DAILY_TARGET = 3;
    const startDay = half === 1 ? 1 : 16;
    const endDayNum = half === 1 ? 15 : new Date(year, month, 0).getDate();
    const start = new Date(year, month - 1, startDay);
    const end = new Date(year, month - 1, endDayNum, 23, 59, 59);

    // Holidays in period
    const holidays = await this.prisma.workCalendar.findMany({
      where: { date: { gte: start, lte: end }, isHoliday: true },
      select: { date: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

    // Build date list (Mon-Sat, exclude holidays)
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay(); // 0=Sun
      const ds = d.toISOString().slice(0, 10);
      if (dow !== 0 && !holidaySet.has(ds)) dates.push(ds);
    }
    const workingDays = dates.length;
    const periodTarget = workingDays * DAILY_TARGET;

    // Completed visits in period
    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: { gte: start, lte: end }, status: 'done' },
      include: {
        employee: {
          select: { id: true, name: true, code: true, position: true, team: { select: { name: true } } },
        },
      },
    });

    type EmpRow = {
      id: string; name: string; code: string; team: string | null;
      daily: Record<string, number>; total: number; target: number;
    };
    const empMap = new Map<string, EmpRow>();

    for (const p of plans) {
      const e = p.employee;
      if (!empMap.has(e.id)) {
        empMap.set(e.id, { id: e.id, name: e.name, code: e.code, team: (e as any).team?.name ?? null, daily: {}, total: 0, target: periodTarget });
      }
      const row = empMap.get(e.id)!;
      const ds = p.planDate.toISOString().slice(0, 10);
      row.daily[ds] = (row.daily[ds] ?? 0) + 1;
      row.total++;
    }

    // Include all active sales employees (even zero visits)
    const allSales = await this.prisma.employee.findMany({
      where: { isActive: true, position: { in: ['sales', 'closer'] } },
      include: { team: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    for (const e of allSales) {
      if (!empMap.has(e.id)) {
        empMap.set(e.id, { id: e.id, name: e.name, code: e.code, team: e.team?.name ?? null, daily: {}, total: 0, target: periodTarget });
      }
    }

    const rows = [...empMap.values()].sort((a, b) => b.total - a.total);

    // Grand totals
    const grandDaily: Record<string, number> = {};
    let grandTotal = 0;
    for (const r of rows) {
      for (const [date, cnt] of Object.entries(r.daily)) {
        grandDaily[date] = (grandDaily[date] ?? 0) + cnt;
        grandTotal += cnt;
      }
    }

    return {
      year, month, half, dates, workingDays, dailyTarget: DAILY_TARGET,
      periodTarget, rows,
      grand: { daily: grandDaily, total: grandTotal, target: periodTarget * rows.length },
    };
  }

  // ── Report 3: Agency Performance ───────────────────────────────────────────
  async agencyPerformance(user: RequestUser, from: string, to: string) {
    const dateFilter = { gte: new Date(from), lte: new Date(to) };

    // 1) All visit plans in range (all statuses — to count done separately)
    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: dateFilter },
      select: {
        id: true,
        agencyId: true,
        planDate: true,
        status: true,
        agency: {
          select: {
            id: true,
            code: true,
            name: true,
            zone: true,
            level: true,
            gradeRelationship: true,
          },
        },
        report: {
          select: { newLeads: true, interestLevel: true },
        },
      },
    });

    // 2) POSM given per agency (via visitPlan → agencyId)
    const posmTxns = await this.prisma.posmTransaction.findMany({
      where: { visitPlan: { planDate: dateFilter } },
      select: { quantity: true, visitPlan: { select: { agencyId: true } } },
    });
    const posmByAgency = new Map<string, number>();
    for (const t of posmTxns) {
      const aid = t.visitPlan.agencyId;
      posmByAgency.set(aid, (posmByAgency.get(aid) ?? 0) + t.quantity);
    }

    // 3) Sales amount per agency
    const salesTxns = await this.prisma.salesActivity.findMany({
      where: { visitPlan: { planDate: dateFilter } },
      select: { amount: true, visitPlan: { select: { agencyId: true } } },
    });
    const salesByAgency = new Map<string, number>();
    for (const s of salesTxns) {
      const aid = s.visitPlan.agencyId;
      salesByAgency.set(aid, (salesByAgency.get(aid) ?? 0) + s.amount);
    }

    // 4) Aggregate per agency
    type AgRow = {
      agencyId: string;
      agencyCode: string;
      agencyName: string;
      zone: string | null;
      grade: string | null;
      totalVisits: number;          // done plans
      totalReports: number;         // plans with VisitReport
      posmGiven: number;
      salesAmount: number;
      lastVisitDate: string | null; // most recent done planDate
      interestScoreSum: number;     // accumulate numeric score for avg
      interestCount: number;
      newLeads: number;
    };

    const agMap = new Map<string, AgRow>();

    for (const p of plans) {
      const a = p.agency;
      if (!agMap.has(a.id)) {
        agMap.set(a.id, {
          agencyId: a.id,
          agencyCode: a.code,
          agencyName: a.name,
          zone: a.zone ?? null,
          grade: a.level ?? null,
          totalVisits: 0,
          totalReports: 0,
          posmGiven: posmByAgency.get(a.id) ?? 0,
          salesAmount: salesByAgency.get(a.id) ?? 0,
          lastVisitDate: null,
          interestScoreSum: 0,
          interestCount: 0,
          newLeads: 0,
        });
      }
      const row = agMap.get(a.id)!;

      if (p.status === 'done') {
        row.totalVisits++;
        const ds = p.planDate.toISOString().slice(0, 10);
        if (!row.lastVisitDate || ds > row.lastVisitDate) row.lastVisitDate = ds;
      }

      if (p.report) {
        row.totalReports++;
        row.newLeads += p.report.newLeads ?? 0;
        const il = p.report.interestLevel;
        const score = il === 'high' ? 3 : il === 'medium' ? 2 : il === 'low' ? 1 : 0;
        if (score > 0) {
          row.interestScoreSum += score;
          row.interestCount++;
        }
      }
    }

    const rows = [...agMap.values()]
      .map(({ interestScoreSum, interestCount, ...r }) => ({
        ...r,
        interestLevel:
          interestCount > 0
            ? (['', 'low', 'medium', 'high'][
                Math.round(interestScoreSum / interestCount)
              ] ?? null)
            : null,
      }))
      .sort((a, b) => b.totalVisits - a.totalVisits);

    return { from, to, rows };
  }
}
