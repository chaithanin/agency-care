import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

function healthLabel(score: number) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'critical';
}

function daysSince(date: Date | null | undefined): number {
  if (!date) return 9999;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function daysUntil(date: Date | null | undefined): number {
  if (!date) return 9999;
  return Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function expectedVisitsPerMonth(freq: string | null | undefined): number {
  if (freq === 'weekly') return 4;
  if (freq === 'biweekly' || freq === 'bi_weekly') return 2;
  return 1;
}

@UseGuards(JwtAuthGuard)
@Roles('manager', 'super_admin', 'admin', 'closer')
@Controller('ai-health')
export class AiHealthController {
  constructor(private readonly db: PrismaService) {}

  @Get('summary')
  async summary() {
    // ─── Agency Health ────────────────────────────────────────────────────────
    const agencies = await this.db.agency.findMany({
      where: { status: 'active' },
      select: {
        id: true, name: true, code: true, level: true, tier: true, pipelineStage: true,
        agreementExpiry: true, agreementActive: true, visitFrequency: true,
      },
      take: 300,
    });

    const ids = agencies.map(a => a.id);

    const [visitStats, saleStats, scoreStats] = ids.length > 0 ? await Promise.all([
      this.db.$queryRaw<{ agency_id: string; last_visit_date: Date | null; last_call_date: Date | null; visits_done_month: bigint }[]>`
        SELECT agency_id,
          MAX(CASE WHEN status='done' THEN plan_date END) AS last_visit_date,
          MAX(call_confirm_at) AS last_call_date,
          COUNT(CASE WHEN status='done' AND plan_date >= date_trunc('month',NOW()) THEN 1 END) AS visits_done_month
        FROM visit_plans
        WHERE agency_id = ANY(${ids}) AND plan_date >= NOW() - INTERVAL '90 days'
        GROUP BY agency_id`,
      this.db.$queryRaw<{ agency_id: string; last_sale_date: Date | null }[]>`
        SELECT vp.agency_id, MAX(sa.created_at) AS last_sale_date
        FROM sales_activities sa
        JOIN visit_plans vp ON sa.visit_plan_id = vp.id
        WHERE vp.agency_id = ANY(${ids}) AND sa.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY vp.agency_id`,
      this.db.$queryRaw<{ agency_id: string; avg_score: number; trend: number }[]>`
        WITH ranked AS (
          SELECT agency_id, overall_score,
            ROW_NUMBER() OVER (PARTITION BY agency_id ORDER BY year DESC, month DESC) AS rn
          FROM agency_scores WHERE agency_id = ANY(${ids})
        ),
        r AS (SELECT agency_id, AVG(overall_score) s FROM ranked WHERE rn<=3 GROUP BY agency_id),
        o AS (SELECT agency_id, AVG(overall_score) s FROM ranked WHERE rn BETWEEN 4 AND 6 GROUP BY agency_id)
        SELECT r.agency_id, r.s AS avg_score, COALESCE(r.s - o.s, 0) AS trend
        FROM r LEFT JOIN o USING(agency_id)`,
    ]) : [[], [], []];

    const vMap = Object.fromEntries(visitStats.map(r => [r.agency_id, r]));
    const sMap = Object.fromEntries(saleStats.map(r => [r.agency_id, r]));
    const scMap = Object.fromEntries(scoreStats.map(r => [r.agency_id, r]));

    const agencyScores = agencies.map(a => {
      const v = vMap[a.id];
      const s = sMap[a.id];
      const sc = scMap[a.id];

      const dsVisit = daysSince(v?.last_visit_date);
      const dsSale = daysSince(s?.last_sale_date);
      const daysContract = daysUntil(a.agreementExpiry);
      const doneMonth = Number(v?.visits_done_month ?? 0);
      const expected = expectedVisitsPerMonth(a.visitFrequency);
      const avgScore = sc?.avg_score ?? null;

      // Penalty
      const p1 = Math.min(25, dsSale > 90 ? 25 : dsSale > 60 ? 15 : dsSale > 30 ? 8 : 0);
      const p2 = Math.min(20, dsVisit > 60 ? 20 : dsVisit > 30 ? 12 : dsVisit > 14 ? 6 : 0);
      const p3 = Math.min(15, !a.agreementExpiry ? 0 : daysContract < 0 ? 15 : daysContract < 30 ? 15 : daysContract < 60 ? 10 : daysContract < 90 ? 5 : 0);
      const p4 = Math.min(10, doneMonth === 0 ? 10 : doneMonth < expected * 0.5 ? 7 : doneMonth < expected * 0.8 ? 3 : 0);
      const p5 = Math.min(15, avgScore === null ? 8 : avgScore < 30 ? 15 : avgScore < 50 ? 10 : avgScore < 70 ? 5 : 0);

      const riskScore = Math.min(100, p1 + p2 + p3 + p4 + p5);

      // Positive boosts
      let bonus = 0;
      if (dsSale < 30) bonus += 5;
      if (dsVisit < 14) bonus += 5;
      if (avgScore !== null && avgScore > 70) bonus += 5;
      if (daysContract > 180) bonus += 5;
      if (doneMonth >= expected) bonus += 5;

      const healthScore = Math.min(100, Math.max(0, 100 - riskScore + bonus));

      return {
        id: a.id, name: a.name, code: a.code,
        level: a.level, tier: a.tier, pipelineStage: a.pipelineStage,
        healthScore, healthLabel: healthLabel(healthScore),
        agencyScore: avgScore !== null ? Math.round(avgScore) : null,
        daysSinceLastVisit: dsVisit < 9999 ? dsVisit : null,
        daysSinceLastSale: dsSale < 9999 ? dsSale : null,
      };
    });

    agencyScores.sort((a, b) => b.healthScore - a.healthScore);

    const agencyAvg = agencyScores.length
      ? Math.round(agencyScores.reduce((s, a) => s + a.healthScore, 0) / agencyScores.length)
      : 0;

    const distribution = { '80-100': 0, '60-79': 0, '40-59': 0, '20-39': 0, '0-19': 0 };
    agencyScores.forEach(a => {
      if (a.healthScore >= 80) distribution['80-100']++;
      else if (a.healthScore >= 60) distribution['60-79']++;
      else if (a.healthScore >= 40) distribution['40-59']++;
      else if (a.healthScore >= 20) distribution['20-39']++;
      else distribution['0-19']++;
    });

    const topAgencies = agencyScores.slice(0, 8);
    const bottomAgencies = [...agencyScores].reverse().slice(0, 8);

    // ─── Employee Health ──────────────────────────────────────────────────────
    const employees = await this.db.employee.findMany({
      where: { user: { isActive: true, role: { in: ['sales', 'closer', 'admin'] } } },
      select: {
        id: true, zone: true, region: true,
        user: { select: { id: true, name: true, role: true } },
        kpiTargets: {
          where: { period: new Date().toISOString().slice(0, 7) },
          take: 1,
          select: { visitTarget: true, visitActual: true },
        },
      },
    });

    const empIds = employees.map(e => e.id);

    const [visitEmpStats, taskEmpStats, checkinStats] = empIds.length > 0 ? await Promise.all([
      this.db.$queryRaw<{ employee_id: string; planned: bigint; done: bigint; confirmed: bigint }[]>`
        SELECT employee_id,
          COUNT(*) AS planned,
          COUNT(CASE WHEN status='done' THEN 1 END) AS done,
          COUNT(CASE WHEN call_confirm_at IS NOT NULL THEN 1 END) AS confirmed
        FROM visit_plans
        WHERE employee_id = ANY(${empIds}) AND plan_date >= date_trunc('month',NOW())
        GROUP BY employee_id`,
      this.db.$queryRaw<{ assigned_to_id: string; overdue: bigint }[]>`
        SELECT assigned_to_id,
          COUNT(CASE WHEN status='overdue' OR (due_date < NOW() AND status != 'done') THEN 1 END) AS overdue
        FROM tasks
        WHERE assigned_to_id = ANY(${empIds})
        GROUP BY assigned_to_id`,
      this.db.$queryRaw<{ employee_id: string; checkins: bigint }[]>`
        SELECT employee_id, COUNT(*) AS checkins
        FROM visit_checkins
        WHERE checkin_at >= date_trunc('month',NOW()) AND employee_id = ANY(${empIds})
        GROUP BY employee_id`,
    ]) : [[], [], []];

    const veMap = Object.fromEntries(visitEmpStats.map(r => [r.employee_id, r]));
    const teMap = Object.fromEntries(taskEmpStats.map(r => [r.assigned_to_id, r]));
    const ceMap = Object.fromEntries(checkinStats.map(r => [r.employee_id, r]));

    const employeeHealthScores = employees.map(emp => {
      const ve = veMap[emp.id];
      const te = teMap[emp.id];
      const ce = ceMap[emp.id];
      const kpi = emp.kpiTargets[0];

      const planned = Number(ve?.planned ?? 0);
      const done = Number(ve?.done ?? 0);
      const confirmed = Number(ve?.confirmed ?? 0);
      const overdue = Number(te?.overdue ?? 0);
      const checkins = Number(ce?.checkins ?? 0);

      const visitRate = planned > 0 ? done / planned : 0;
      const confirmRate = planned > 0 ? confirmed / planned : 0;
      const checkinRate = done > 0 ? checkins / done : 0;
      const kpiRate = kpi && kpi.visitTarget > 0 ? kpi.visitActual / kpi.visitTarget : null;

      // Penalties
      const pOverdue = overdue > 20 ? 30 : overdue > 10 ? 20 : overdue > 5 ? 10 : 0;
      const pVisit = visitRate < 0.5 ? 25 : visitRate < 0.7 ? 15 : visitRate < 0.85 ? 8 : 0;
      const pConfirm = confirmRate < 0.4 ? 15 : confirmRate < 0.6 ? 8 : 0;
      const pCheckin = checkinRate < 0.5 && done > 0 ? 10 : 0;
      const pKpi = kpiRate !== null ? (kpiRate < 0.5 ? 10 : kpiRate < 0.7 ? 5 : 0) : 5;

      const riskScore = Math.min(100, pOverdue + pVisit + pConfirm + pCheckin + pKpi);
      const healthScore = Math.max(0, 100 - riskScore);

      return {
        employeeId: emp.id,
        name: emp.user.name, role: emp.user.role,
        zone: emp.zone, region: emp.region,
        healthScore, healthLabel: healthLabel(healthScore),
        stats: { planned, done, overdue, checkins, visitRate: Math.round(visitRate * 100), kpiRate: kpiRate !== null ? Math.round(kpiRate * 100) : null },
      };
    });

    employeeHealthScores.sort((a, b) => b.healthScore - a.healthScore);

    const empAvg = employeeHealthScores.length
      ? Math.round(employeeHealthScores.reduce((s, e) => s + e.healthScore, 0) / employeeHealthScores.length)
      : 0;

    // Group by zone
    const byZone: Record<string, { zone: string; avg: number; count: number; employees: typeof employeeHealthScores }> = {};
    for (const e of employeeHealthScores) {
      const z = e.zone ?? 'ไม่ระบุ';
      if (!byZone[z]) byZone[z] = { zone: z, avg: 0, count: 0, employees: [] };
      byZone[z].employees.push(e);
      byZone[z].count++;
    }
    for (const z of Object.values(byZone)) {
      z.avg = Math.round(z.employees.reduce((s, e) => s + e.healthScore, 0) / z.employees.length);
    }
    const teams = Object.values(byZone).sort((a, b) => b.avg - a.avg);

    // Organization score = weighted average (agencies 60%, employees 40%)
    const orgScore = Math.round(agencyAvg * 0.6 + empAvg * 0.4);

    return {
      orgScore,
      orgLabel: healthLabel(orgScore),
      agency: { avg: agencyAvg, total: agencyScores.length, distribution, topAgencies, bottomAgencies },
      employee: { avg: empAvg, total: employeeHealthScores.length, byEmployee: employeeHealthScores, teams },
    };
  }
}
