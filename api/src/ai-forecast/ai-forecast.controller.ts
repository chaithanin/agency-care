import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

function trendMultiplier(values: number[]): number {
  if (values.length < 2) return 1;
  // Simple linear trend from last N months
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((acc, v, i) => acc + i * v, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const projected = intercept + slope * n;
  const avg = sumY / n;
  return avg > 0 ? projected / avg : 1;
}

function lastNPeriods(n: number): string[] {
  const periods: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function nextPeriod(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function daysElapsedInCurrentMonth(): number {
  const now = new Date();
  return now.getDate();
}

@UseGuards(JwtAuthGuard)
@Roles('manager', 'super_admin', 'admin', 'closer')
@Controller('ai-forecast')
export class AiForecastController {
  constructor(private readonly db: PrismaService) {}

  // ── KPI Forecast per Sale ─────────────────────────────────────────────────

  @Get('kpi')
  async kpiForecast() {
    const periods6 = lastNPeriods(6);
    const curPeriod = currentPeriod();
    const nxtPeriod = nextPeriod();
    const totalDays = daysInMonth(curPeriod);
    const elapsedDays = daysElapsedInCurrentMonth();
    const progressRate = elapsedDays / totalDays;

    const kpiData = await this.db.kpiTarget.findMany({
      where: { period: { in: [...periods6, nxtPeriod] } },
      include: {
        employee: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
      orderBy: { period: 'asc' },
    });

    // Group by employee
    const byEmployee: Record<string, typeof kpiData> = {};
    for (const k of kpiData) {
      if (!byEmployee[k.employeeId]) byEmployee[k.employeeId] = [];
      byEmployee[k.employeeId].push(k);
    }

    const items = Object.entries(byEmployee).map(([empId, records]) => {
      const emp = records[0].employee;
      const history = records.filter(r => r.period < curPeriod).sort((a, b) => a.period.localeCompare(b.period));
      const current = records.find(r => r.period === curPeriod);

      // Use last 3 completed months for trend
      const last3 = history.slice(-3);

      // Visit forecast
      const visitActuals = last3.map(r => r.visitActual ?? 0);
      const visitTargets = last3.map(r => r.visitTarget ?? 0);
      const avgVisitActual = visitActuals.length ? visitActuals.reduce((a, b) => a + b, 0) / visitActuals.length : 0;
      const visitTrend = trendMultiplier(visitActuals);
      const curVisitTarget = current?.visitTarget ?? (visitTargets.length ? visitTargets[visitTargets.length - 1] : 0);
      const curVisitActual = current?.visitActual ?? 0;
      // Extrapolate current month to end-of-month
      const curVisitProjected = progressRate > 0 ? Math.round(curVisitActual / progressRate) : curVisitActual;
      const nextVisitForecast = Math.round(avgVisitActual * Math.max(0.5, Math.min(1.5, visitTrend)));

      // Sales forecast
      const salesActuals = last3.map(r => Number(r.salesActual ?? 0));
      const salesTargets = last3.map(r => Number(r.salesTarget ?? 0));
      const avgSalesActual = salesActuals.length ? salesActuals.reduce((a, b) => a + b, 0) / salesActuals.length : 0;
      const salesTrend = trendMultiplier(salesActuals);
      const curSalesTarget = Number(current?.salesTarget ?? (salesTargets.length ? salesTargets[salesTargets.length - 1] : 0));
      const curSalesActual = Number(current?.salesActual ?? 0);
      const curSalesProjected = progressRate > 0 ? Math.round(curSalesActual / progressRate) : curSalesActual;
      const nextSalesForecast = Math.round(avgSalesActual * Math.max(0.5, Math.min(1.5, salesTrend)));

      // Followup forecast
      const followActuals = last3.map(r => r.followupActual ?? 0);
      const avgFollowActual = followActuals.length ? followActuals.reduce((a, b) => a + b, 0) / followActuals.length : 0;
      const followTrend = trendMultiplier(followActuals);
      const nextFollowForecast = Math.round(avgFollowActual * Math.max(0.5, Math.min(1.5, followTrend)));

      // Achievement rate for current month
      const visitAchRate = curVisitTarget > 0 ? curVisitActual / curVisitTarget : null;
      const visitProjRate = curVisitTarget > 0 ? curVisitProjected / curVisitTarget : null;

      // Risk status
      const riskStatus =
        visitProjRate === null ? 'unknown' :
        visitProjRate >= 1 ? 'on_track' :
        visitProjRate >= 0.8 ? 'at_risk' : 'critical';

      return {
        employeeId: empId,
        name: emp.user.name,
        role: emp.user.role,
        zone: emp.zone, region: emp.region,
        currentPeriod: {
          period: curPeriod,
          visitTarget: curVisitTarget,
          visitActual: curVisitActual,
          visitProjected: curVisitProjected,
          visitAchRate: visitAchRate !== null ? Math.round(visitAchRate * 100) : null,
          visitProjRate: visitProjRate !== null ? Math.round(visitProjRate * 100) : null,
          salesTarget: curSalesTarget,
          salesActual: curSalesActual,
          salesProjected: curSalesProjected,
          elapsedDays, totalDays, progressRate: Math.round(progressRate * 100),
        },
        nextPeriod: {
          period: nxtPeriod,
          visitForecast: nextVisitForecast,
          salesForecast: nextSalesForecast,
          followupForecast: nextFollowForecast,
          visitTrend: Math.round((visitTrend - 1) * 100),
          salesTrend: Math.round((salesTrend - 1) * 100),
        },
        history: last3.map(r => ({
          period: r.period,
          visitTarget: r.visitTarget,
          visitActual: r.visitActual,
          salesActual: Number(r.salesActual),
        })),
        riskStatus,
      };
    });

    // Sort: critical first
    const order = { critical: 0, at_risk: 1, on_track: 2, unknown: 3 };
    items.sort((a, b) => (order[a.riskStatus as keyof typeof order] ?? 3) - (order[b.riskStatus as keyof typeof order] ?? 3));

    return { currentPeriod: curPeriod, nextPeriod: nxtPeriod, items };
  }

  // ── Workload Forecast ─────────────────────────────────────────────────────

  @Get('workload')
  async workloadForecast() {
    const curPeriod = currentPeriod();
    const nxtPeriod = nextPeriod();
    const periods3 = lastNPeriods(3);

    // Count tasks created/completed per month
    const taskStats = await this.db.$queryRaw<{
      period: string;
      created_count: bigint;
      done_count: bigint;
    }[]>`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS period,
        COUNT(*) AS created_count,
        COUNT(CASE WHEN status = 'done' THEN 1 END) AS done_count
      FROM tasks
      WHERE created_at >= NOW() - INTERVAL '3 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY period
    `;

    // Visit plans per month
    const visitStats = await this.db.$queryRaw<{
      period: string;
      planned_count: bigint;
      done_count: bigint;
    }[]>`
      SELECT
        TO_CHAR(plan_date, 'YYYY-MM') AS period,
        COUNT(*) AS planned_count,
        COUNT(CASE WHEN status = 'done' THEN 1 END) AS done_count
      FROM visit_plans
      WHERE plan_date >= NOW() - INTERVAL '3 months'
        AND plan_date < NOW() + INTERVAL '1 month'
      GROUP BY TO_CHAR(plan_date, 'YYYY-MM')
      ORDER BY period
    `;

    // Active sales count
    const activeSales = await this.db.employee.count({
      where: { user: { isActive: true, role: { in: ['sales', 'closer'] } } },
    });

    // Pending tasks now
    const openTasks = await this.db.task.count({ where: { status: { in: ['pending', 'in_progress'] } } });
    const overdueTasks = await this.db.task.count({ where: { status: 'overdue' } });

    const taskMap = Object.fromEntries(taskStats.map(r => [r.period, { created: Number(r.created_count), done: Number(r.done_count) }]));
    const visitMap = Object.fromEntries(visitStats.map(r => [r.period, { planned: Number(r.planned_count), done: Number(r.done_count) }]));

    // Calculate trends
    const taskCreated = periods3.map(p => taskMap[p]?.created ?? 0);
    const visitPlanned = periods3.map(p => visitMap[p]?.planned ?? 0);
    const taskTrend = trendMultiplier(taskCreated);
    const visitTrend = trendMultiplier(visitPlanned);

    const avgTaskCreated = taskCreated.reduce((a, b) => a + b, 0) / (taskCreated.length || 1);
    const avgVisitPlanned = visitPlanned.reduce((a, b) => a + b, 0) / (visitPlanned.length || 1);

    const nextTaskForecast = Math.round(avgTaskCreated * Math.max(0.7, Math.min(1.3, taskTrend)));
    const nextVisitForecast = Math.round(avgVisitPlanned * Math.max(0.7, Math.min(1.3, visitTrend)));

    // Capacity per sale (8 visits/month target standard)
    const visitCapacity = activeSales * 8;
    const capacityPct = visitCapacity > 0 ? Math.round((nextVisitForecast / visitCapacity) * 100) : null;

    const periods = periods3.map(p => ({
      period: p,
      tasks: taskMap[p] ?? { created: 0, done: 0 },
      visits: visitMap[p] ?? { planned: 0, done: 0 },
    }));

    return {
      currentPeriod: curPeriod,
      nextPeriod: nxtPeriod,
      activeSales,
      snapshot: { openTasks, overdueTasks },
      history: periods,
      forecast: {
        period: nxtPeriod,
        taskForecast: nextTaskForecast,
        visitForecast: nextVisitForecast,
        visitCapacity,
        capacityPct,
        taskTrend: Math.round((taskTrend - 1) * 100),
        visitTrend: Math.round((visitTrend - 1) * 100),
      },
    };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  async dashboard() {
    const [kpiResult, workResult] = await Promise.all([
      this.kpiForecast(),
      this.workloadForecast(),
    ]);

    const onTrack = kpiResult.items.filter(i => i.riskStatus === 'on_track').length;
    const atRisk = kpiResult.items.filter(i => i.riskStatus === 'at_risk').length;
    const critical = kpiResult.items.filter(i => i.riskStatus === 'critical').length;
    const total = kpiResult.items.length;

    const avgVisitProjRate = total > 0
      ? Math.round(kpiResult.items.reduce((acc, i) => acc + (i.currentPeriod.visitProjRate ?? 0), 0) / total)
      : 0;

    const avgVisitForecast = total > 0
      ? Math.round(kpiResult.items.reduce((acc, i) => acc + i.nextPeriod.visitForecast, 0) / total)
      : 0;

    const alerts: string[] = [];
    if (critical > 0) alerts.push(`Sale ${critical} คน คาดว่า KPI จะต่ำกว่าเป้า 80%`);
    if (atRisk > 0) alerts.push(`Sale ${atRisk} คน KPI อาจไม่ถึงเป้าเดือนนี้`);
    if (workResult.forecast.capacityPct && workResult.forecast.capacityPct > 90)
      alerts.push(`Workload เดือนหน้าใกล้ขีดจำกัด (${workResult.forecast.capacityPct}%)`);
    if ((workResult.snapshot.overdueTasks) > 30)
      alerts.push(`Task ค้างสะสม ${workResult.snapshot.overdueTasks} งาน ควรเร่งเคลียร์`);

    return {
      currentPeriod: kpiResult.currentPeriod,
      nextPeriod: kpiResult.nextPeriod,
      summary: { total, onTrack, atRisk, critical, avgVisitProjRate, avgVisitForecast },
      workload: workResult.forecast,
      topAtRisk: kpiResult.items.filter(i => i.riskStatus !== 'on_track').slice(0, 5),
      alerts,
    };
  }

  // ── Agency Growth Forecast ────────────────────────────────────────────────

  @Get('agency-growth')
  async agencyGrowth() {
    // Get agencies with tier info
    const agencies = await this.db.agency.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true, tier: true, level: true },
      take: 300,
    });

    if (!agencies.length) return { upgrades: [], downgrades: [], stable: [] };
    const ids = agencies.map(a => a.id);

    // Get last 4 months of scores per agency
    const scores = await this.db.$queryRaw<{
      agency_id: string; month: number; year: number; overall_score: number;
    }[]>`
      SELECT agency_id, month, year, overall_score
      FROM agency_scores
      WHERE agency_id = ANY(${ids})
        AND (year * 100 + month) >= (EXTRACT(YEAR FROM NOW())::int * 100 + EXTRACT(MONTH FROM NOW())::int - 3)
      ORDER BY agency_id, year, month
    `;

    // Group by agency
    const byAgency: Record<string, { month: number; year: number; overall_score: number }[]> = {};
    for (const s of scores) {
      if (!byAgency[s.agency_id]) byAgency[s.agency_id] = [];
      byAgency[s.agency_id].push(s);
    }

    function tierFromScore(score: number): string {
      if (score >= 90) return 'platinum';
      if (score >= 70) return 'gold';
      if (score >= 50) return 'silver';
      if (score >= 30) return 'bronze';
      return 'at_risk';
    }

    const TIER_ORDER = ['at_risk', 'bronze', 'silver', 'gold', 'platinum'];

    const upgrades: object[] = [];
    const downgrades: object[] = [];
    const stable: object[] = [];

    for (const a of agencies) {
      const history = byAgency[a.id];
      if (!history || history.length < 2) continue;

      const vals = history.map(h => h.overall_score);
      const trend = trendMultiplier(vals);
      const latest = vals[vals.length - 1];
      const forecastScore = Math.min(100, Math.max(0, Math.round(latest * Math.max(0.5, Math.min(1.5, trend))))));

      const currentTier = tierFromScore(latest);
      const forecastTier = tierFromScore(forecastScore);
      const currentRank = TIER_ORDER.indexOf(currentTier);
      const forecastRank = TIER_ORDER.indexOf(forecastTier);

      const item = {
        id: a.id, name: a.name, code: a.code,
        currentTier: a.tier ?? currentTier,
        scoreTier: currentTier,
        forecastTier,
        currentScore: Math.round(latest),
        forecastScore,
        scoreDelta: forecastScore - Math.round(latest),
        trend: Math.round((trend - 1) * 100),
        historyScores: vals,
      };

      if (forecastRank > currentRank) upgrades.push(item);
      else if (forecastRank < currentRank) downgrades.push(item);
      else stable.push(item);
    }

    return {
      upgrades: upgrades.sort((a: any, b: any) => b.scoreDelta - a.scoreDelta),
      downgrades: downgrades.sort((a: any, b: any) => a.scoreDelta - b.scoreDelta),
      stable: stable.slice(0, 20),
    };
  }

  // ── Scenario Simulator ────────────────────────────────────────────────────

  @Get('scenario')
  async scenario(
    @Query('addSales') addSales = '0',
    @Query('visitTargetChange') visitTargetChange = '0',
  ) {
    const add = parseInt(addSales) || 0;
    const targetDelta = parseInt(visitTargetChange) || 0;

    const work = await this.workloadForecast();
    const baseSales = work.activeSales;
    const newSales = baseSales + add;
    const baseVisit = work.forecast.visitForecast;
    const baseCapacity = work.forecast.visitCapacity ?? 0;

    const adjustedCapacity = newSales * 8;
    const adjustedVisitTarget = Math.round(baseVisit * (1 + targetDelta / 100));
    const newCapacityPct = adjustedCapacity > 0 ? Math.round((adjustedVisitTarget / adjustedCapacity) * 100) : null;

    const coverageBase = baseCapacity > 0 ? Math.round((baseVisit / baseCapacity) * 100) : null;
    const coverageNew = newCapacityPct;

    return {
      base: { sales: baseSales, visitForecast: baseVisit, capacity: baseCapacity, capacityPct: work.forecast.capacityPct },
      scenario: { sales: newSales, visitForecast: adjustedVisitTarget, capacity: adjustedCapacity, capacityPct: coverageNew },
      delta: {
        salesDelta: add,
        visitTargetChangePct: targetDelta,
        capacityGainPct: coverageNew !== null && coverageBase !== null ? coverageBase - coverageNew : null,
      },
    };
  }
}
