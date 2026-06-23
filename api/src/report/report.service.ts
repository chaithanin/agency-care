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

    const rows = [...empMap.values()].sort((a, b) => b.total - a.total);

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
      }),
      { visit_agency: 0, agency_brings_client: 0, training: 0, other: 0, total: 0, completed: 0, withReport: 0, leads: 0 },
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

  // ── Report 3: Agency Performance ───────────────────────────────────────────
  async agencyPerformance(user: RequestUser, from: string, to: string) {
    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate: { gte: new Date(from), lte: new Date(to) } },
      include: {
        agency: { select: { id: true, code: true, name: true, zone: true, province: true, level: true, tier: true } },
        report: { select: { newLeads: true, interestLevel: true, nextVisitDate: true } },
        checkin: { select: { id: true } },
      },
    });

    type AgRow = {
      id: string; code: string; name: string; zone?: string | null; province?: string | null;
      level?: string | null; tier?: string | null;
      visits: number; completed: number; withReport: number;
      leads: number; avgInterest: number; lastVisit: string | null;
      score: number;
    };

    const agMap = new Map<string, AgRow>();

    for (const p of plans) {
      const a = p.agency;
      if (!agMap.has(a.id)) {
        agMap.set(a.id, {
          id: a.id, code: a.code, name: a.name,
          zone: a.zone, province: a.province, level: a.level, tier: a.tier,
          visits: 0, completed: 0, withReport: 0, leads: 0,
          avgInterest: 0, lastVisit: null, score: 0,
        });
      }
      const row = agMap.get(a.id)!;
      row.visits++;

      const planDate = p.planDate.toISOString().slice(0, 10);
      if (!row.lastVisit || planDate > row.lastVisit) row.lastVisit = planDate;

      if (p.status === 'done') row.completed++;
      if (p.report) {
        row.withReport++;
        row.leads += p.report.newLeads ?? 0;
        const il = p.report.interestLevel;
        const score = il === 'high' ? 3 : il === 'medium' ? 2 : il === 'low' ? 1 : 0;
        row.avgInterest += score;
      }
    }

    const rows = [...agMap.values()]
      .map((r) => {
        const interestAvg = r.withReport > 0 ? r.avgInterest / r.withReport : 0;
        const completionRate = r.visits > 0 ? r.completed / r.visits : 0;
        const score = Math.round(r.completed * 10 + r.leads * 5 + interestAvg * 8 + completionRate * 15);
        return { ...r, avgInterest: Math.round(interestAvg * 10) / 10, score };
      })
      .sort((a, b) => b.score - a.score || b.completed - a.completed);

    return { from, to, rows };
  }
}
