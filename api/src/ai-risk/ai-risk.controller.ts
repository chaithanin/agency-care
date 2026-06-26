import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

function calcRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function daysSince(date: Date | null | undefined): number {
  if (!date) return 9999;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function daysUntil(date: Date | null | undefined): number {
  if (!date) return 9999;
  return Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function expectedVisitsPerMonth(freq: number | null | undefined): number {
  return freq ?? 1;
}

@UseGuards(JwtAuthGuard)
@Roles('manager', 'super_admin', 'admin', 'closer')
@Controller('ai-risk')
export class AiRiskController {
  constructor(private readonly db: PrismaService) {}

  // ── Agency Risk ──────────────────────────────────────────────────────────

  @Get('agencies')
  async agencyRisks(@Query('limit') limit = '100', @Query('search') search?: string) {
    const take = Math.min(parseInt(limit) || 100, 300);

    const agencies = await this.db.agency.findMany({
      where: {
        status: 'active',
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true, name: true, code: true, level: true, tier: true,
        agreementExpiry: true, agreementActive: true,
        visitFrequency: true, pipelineStage: true,
      },
      take,
    });

    if (!agencies.length) return { total: 0, items: [] };
    const ids = agencies.map(a => a.id);

    // Visit stats per agency (last 6 months)
    const visitStats = await this.db.$queryRaw<{
      agency_id: string;
      last_visit_date: Date | null;
      last_call_date: Date | null;
      visits_done_30d: bigint;
      visits_done_month: bigint;
      visits_planned_month: bigint;
    }[]>`
      SELECT
        agency_id,
        MAX(CASE WHEN status = 'done' THEN plan_date END)   AS last_visit_date,
        MAX(call_confirm_at)                                 AS last_call_date,
        COUNT(CASE WHEN status = 'done' AND plan_date >= NOW() - INTERVAL '30 days' THEN 1 END) AS visits_done_30d,
        COUNT(CASE WHEN status = 'done' AND plan_date >= date_trunc('month', NOW()) THEN 1 END) AS visits_done_month,
        COUNT(CASE WHEN plan_date >= date_trunc('month', NOW()) THEN 1 END)                      AS visits_planned_month
      FROM visit_plans
      WHERE agency_id = ANY(${ids})
        AND plan_date >= NOW() - INTERVAL '180 days'
      GROUP BY agency_id
    `;

    // Last sale per agency
    const saleStats = await this.db.$queryRaw<{
      agency_id: string;
      last_sale_date: Date | null;
      total_amount: number | null;
    }[]>`
      SELECT
        vp.agency_id,
        MAX(sa.created_at)  AS last_sale_date,
        SUM(sa.amount)      AS total_amount
      FROM sales_activities sa
      JOIN visit_plans vp ON sa.visit_plan_id = vp.id
      WHERE vp.agency_id = ANY(${ids})
        AND sa.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY vp.agency_id
    `;

    // Latest agency score per agency
    const scoreStats = await this.db.$queryRaw<{
      agency_id: string;
      avg_score: number;
      score_trend: number;
    }[]>`
      WITH ranked AS (
        SELECT agency_id, overall_score,
          ROW_NUMBER() OVER (PARTITION BY agency_id ORDER BY year DESC, month DESC) AS rn
        FROM agency_scores
        WHERE agency_id = ANY(${ids})
      ),
      recent AS (SELECT agency_id, AVG(overall_score) AS s FROM ranked WHERE rn <= 3 GROUP BY agency_id),
      older  AS (SELECT agency_id, AVG(overall_score) AS s FROM ranked WHERE rn BETWEEN 4 AND 6 GROUP BY agency_id)
      SELECT r.agency_id, r.s AS avg_score, COALESCE(r.s - o.s, 0) AS score_trend
      FROM recent r LEFT JOIN older o USING (agency_id)
    `;

    // Overdue tasks per agency
    const taskStats = await this.db.$queryRaw<{
      agency_id: string;
      overdue_count: bigint;
    }[]>`
      SELECT agency_id, COUNT(*) AS overdue_count
      FROM tasks
      WHERE agency_id = ANY(${ids})
        AND status != 'done'
        AND due_date < NOW()
      GROUP BY agency_id
    `;

    const vMap = Object.fromEntries(visitStats.map(r => [r.agency_id, r]));
    const sMap = Object.fromEntries(saleStats.map(r => [r.agency_id, r]));
    const scMap = Object.fromEntries(scoreStats.map(r => [r.agency_id, r]));
    const tMap = Object.fromEntries(taskStats.map(r => [r.agency_id, r]));
    const now = Date.now();

    const items = agencies.map(a => {
      const v = vMap[a.id];
      const s = sMap[a.id];
      const sc = scMap[a.id];
      const t = tMap[a.id];

      const dsSale = daysSince(s?.last_sale_date);
      const dsVisit = daysSince(v?.last_visit_date);
      const dsCall = daysSince(v?.last_call_date);
      const duContract = daysUntil(a.agreementExpiry);
      const doneMonth = Number(v?.visits_done_month ?? 0);
      const expected = expectedVisitsPerMonth(a.visitFrequency);
      const overdueTasks = Number(t?.overdue_count ?? 0);
      const avgScore = sc?.avg_score ?? null;
      const scoreTrend = sc?.score_trend ?? 0;

      // Factor scores (weighted, max sum = 100)
      const f1 = Math.min(25, dsSale > 90 ? 25 : dsSale > 60 ? 15 : dsSale > 30 ? 8 : 0);
      const f2 = Math.min(20, dsVisit > 60 ? 20 : dsVisit > 30 ? 12 : dsVisit > 14 ? 6 : 0);
      const f3 = Math.min(15, dsCall > 45 ? 15 : dsCall > 21 ? 8 : dsCall > 14 ? 4 : 0);
      const f4 = Math.min(15,
        !a.agreementExpiry ? 0 :
        duContract < 0 ? 15 : duContract < 30 ? 15 : duContract < 60 ? 10 : duContract < 90 ? 5 : 0,
      );
      const f5 = Math.min(10,
        doneMonth === 0 ? 10 : doneMonth < expected * 0.5 ? 7 : doneMonth < expected * 0.8 ? 3 : 0,
      );
      const f6 = Math.min(15,
        avgScore === null ? 8 :
        avgScore < 30 ? 15 : avgScore < 50 ? 10 : avgScore < 70 ? 5 : 0,
      ) + (scoreTrend < -10 ? Math.min(5, 15) : 0);

      const riskScore = Math.min(100, f1 + f2 + f3 + Math.min(15, f4) + f5 + Math.min(15, f6));
      const riskLevel = calcRiskLevel(riskScore);

      const factors = [
        { name: 'ยอดขาย', detail: dsSale < 9999 ? `${dsSale} วันที่แล้ว` : 'ไม่มีข้อมูล', score: f1, weight: 25 },
        { name: 'เข้าเยี่ยม', detail: dsVisit < 9999 ? `${dsVisit} วันที่แล้ว` : 'ไม่มีข้อมูล', score: f2, weight: 20 },
        { name: 'โทร Follow-up', detail: dsCall < 9999 ? `${dsCall} วันที่แล้ว` : 'ไม่มีข้อมูล', score: f3, weight: 15 },
        { name: 'สัญญา', detail: a.agreementExpiry ? (duContract < 0 ? 'หมดแล้ว' : `เหลือ ${duContract} วัน`) : 'ไม่มีสัญญา', score: Math.min(15, f4), weight: 15 },
        { name: 'ความถี่เยี่ยม', detail: `${doneMonth}/${expected} ครั้งเดือนนี้`, score: f5, weight: 10 },
        { name: 'คะแนน Agency', detail: avgScore !== null ? `${Math.round(avgScore)}/100${scoreTrend < -5 ? ' ↓' : scoreTrend > 5 ? ' ↑' : ''}` : 'ไม่มีข้อมูล', score: Math.min(15, f6), weight: 15 },
      ];

      const recommendations: string[] = [];
      if (f1 >= 15) recommendations.push('เสนอ Promotion พิเศษ');
      if (f2 >= 12) recommendations.push('เข้าเยี่ยมภายใน 7 วัน');
      if (f3 >= 8) recommendations.push('โทร Follow-up ด่วน');
      if (Math.min(15, f4) >= 10) recommendations.push('ติดต่อต่อสัญญา');
      if (f5 >= 7) recommendations.push('เพิ่มความถี่ Site Visit');
      if (riskLevel === 'critical' || riskLevel === 'high') recommendations.push('นัด Training');
      if (!recommendations.length) recommendations.push('ติดตามสถานการณ์');

      return {
        id: a.id, name: a.name, code: a.code,
        level: a.level, tier: a.tier, pipelineStage: a.pipelineStage,
        riskScore, riskLevel, factors, recommendations,
        daysSinceLastVisit: dsVisit < 9999 ? dsVisit : null,
        daysSinceLastSale: dsSale < 9999 ? dsSale : null,
        daysSinceLastCall: dsCall < 9999 ? dsCall : null,
        agreementExpiry: a.agreementExpiry,
        daysUntilExpiry: a.agreementExpiry ? duContract : null,
        overdueTaskCount: overdueTasks,
        lastSaleAmount: s?.total_amount ?? null,
        agencyScore: avgScore !== null ? Math.round(avgScore) : null,
        scoreTrend,
      };
    });

    items.sort((a, b) => b.riskScore - a.riskScore);
    return { total: items.length, items };
  }

  // ── Sale Risk ─────────────────────────────────────────────────────────────

  @Get('sales')
  async salesRisks() {
    const employees = await this.db.employee.findMany({
      where: { user: { isActive: true, role: { in: ['sales', 'closer', 'admin'] } } },
      select: {
        id: true,
        user: { select: { id: true, name: true, role: true } },
        zone: true,
        kpiTargets: {
          where: { period: new Date().toISOString().slice(0, 7) },
          take: 1,
          select: { visitTarget: true, visitActual: true, followupTarget: true, followupActual: true },
        },
      },
    });

    if (!employees.length) return { total: 0, items: [] };
    const empIds = employees.map(e => e.id);

    // Visit completion this month per employee
    const visitMonth = await this.db.$queryRaw<{
      employee_id: string;
      total_planned: bigint;
      total_done: bigint;
      total_confirmed: bigint;
    }[]>`
      SELECT
        employee_id,
        COUNT(*) AS total_planned,
        COUNT(CASE WHEN status = 'done' THEN 1 END) AS total_done,
        COUNT(CASE WHEN call_confirm_at IS NOT NULL THEN 1 END) AS total_confirmed
      FROM visit_plans
      WHERE employee_id = ANY(${empIds})
        AND plan_date >= date_trunc('month', NOW())
      GROUP BY employee_id
    `;

    // Overdue tasks per employee
    const taskOverdue = await this.db.$queryRaw<{
      assigned_to_id: string;
      overdue_count: bigint;
      total_open: bigint;
    }[]>`
      SELECT
        assigned_to_id,
        COUNT(CASE WHEN status = 'overdue' OR (due_date < NOW() AND status != 'done') THEN 1 END) AS overdue_count,
        COUNT(CASE WHEN status != 'done' THEN 1 END) AS total_open
      FROM tasks
      WHERE assigned_to_id = ANY(${empIds})
      GROUP BY assigned_to_id
    `;

    // GPS check-in rate this month
    const checkinStats = await this.db.$queryRaw<{
      employee_id: string;
      checkin_count: bigint;
      valid_gps: bigint;
    }[]>`
      SELECT
        employee_id,
        COUNT(*) AS checkin_count,
        COUNT(CASE WHEN gps_status = 'valid' THEN 1 END) AS valid_gps
      FROM visit_checkins
      WHERE checkin_at >= date_trunc('month', NOW())
        AND employee_id = ANY(${empIds})
      GROUP BY employee_id
    `;

    const vmMap = Object.fromEntries(visitMonth.map(r => [r.employee_id, r]));
    const tmMap = Object.fromEntries(taskOverdue.map(r => [r.assigned_to_id, r]));
    const cmMap = Object.fromEntries(checkinStats.map(r => [r.employee_id, r]));

    const items = employees.map(emp => {
      const vm = vmMap[emp.id];
      const tm = tmMap[emp.id];
      const cm = cmMap[emp.id];
      const kpi = emp.kpiTargets[0];

      const planned = Number(vm?.total_planned ?? 0);
      const done = Number(vm?.total_done ?? 0);
      const confirmed = Number(vm?.total_confirmed ?? 0);
      const overdueCount = Number(tm?.overdue_count ?? 0);
      const totalOpen = Number(tm?.total_open ?? 0);
      const checkins = Number(cm?.checkin_count ?? 0);

      // Visit completion rate
      const visitRate = planned > 0 ? done / planned : 0;
      // Call confirm rate
      const confirmRate = planned > 0 ? confirmed / planned : 0;
      // KPI achievement
      const kpiVisitRate = kpi && (kpi.visitTarget ?? 0) > 0 ? (kpi.visitActual ?? 0) / (kpi.visitTarget ?? 1) : null;
      // Checkin rate vs done
      const checkinRate = done > 0 ? checkins / done : 0;

      // Risk factors (penalty points — high = more risk)
      const f1 = overdueCount > 20 ? 30 : overdueCount > 10 ? 20 : overdueCount > 5 ? 10 : 0;
      const f2 = visitRate < 0.5 ? 25 : visitRate < 0.7 ? 15 : visitRate < 0.85 ? 8 : 0;
      const f3 = confirmRate < 0.4 ? 20 : confirmRate < 0.6 ? 12 : confirmRate < 0.8 ? 5 : 0;
      const f4 = checkinRate < 0.5 && done > 0 ? 15 : checkinRate < 0.7 && done > 0 ? 8 : 0;
      const f5 = kpiVisitRate !== null ? (kpiVisitRate < 0.5 ? 10 : kpiVisitRate < 0.7 ? 6 : kpiVisitRate < 0.9 ? 2 : 0) : 5;

      const riskScore = Math.min(100, f1 + f2 + f3 + f4 + f5);
      const performanceScore = Math.max(0, 100 - riskScore);
      const riskLevel = calcRiskLevel(riskScore);

      const issues: string[] = [];
      if (overdueCount > 10) issues.push(`Task ค้าง ${overdueCount} งาน`);
      if (visitRate < 0.7) issues.push(`Site Visit ทำได้ ${Math.round(visitRate * 100)}%`);
      if (confirmRate < 0.6) issues.push(`Call Confirm ต่ำ ${Math.round(confirmRate * 100)}%`);
      if (checkinRate < 0.5 && done > 0) issues.push('Check-in GPS ต่ำ');
      if (kpiVisitRate !== null && kpiVisitRate < 0.7) issues.push(`KPI Visit ${Math.round(kpiVisitRate * 100)}%`);
      if (!issues.length) issues.push('อยู่ในเกณฑ์ดี');

      const recommendations: string[] = [];
      if (f1 >= 20) recommendations.push('จัดลำดับ Task ใหม่');
      if (f2 >= 15) recommendations.push('ลดพื้นที่รับผิดชอบชั่วคราว');
      if (f3 >= 12) recommendations.push('เพิ่ม Training การโทร');
      if (riskLevel === 'critical') recommendations.push('Closer Coaching ด่วน');
      if (riskLevel === 'high') recommendations.push('ประชุม 1-on-1');
      if (!recommendations.length) recommendations.push('ติดตามปกติ');

      return {
        employeeId: emp.id,
        userId: emp.user?.id ?? '',
        name: emp.user?.name ?? '',
        role: emp.user?.role ?? '',
        zone: emp.zone,
        performanceScore, riskScore, riskLevel,
        factors: [
          { name: 'Task ค้าง', detail: `${overdueCount} งาน`, score: f1, weight: 30 },
          { name: 'Site Visit', detail: `${done}/${planned} (${Math.round(visitRate * 100)}%)`, score: f2, weight: 25 },
          { name: 'Call Confirm', detail: `${Math.round(confirmRate * 100)}%`, score: f3, weight: 20 },
          { name: 'GPS Check-in', detail: `${Math.round(checkinRate * 100)}%`, score: f4, weight: 15 },
          { name: 'KPI', detail: kpiVisitRate !== null ? `${Math.round(kpiVisitRate * 100)}%` : 'ไม่มีข้อมูล', score: f5, weight: 10 },
        ],
        issues, recommendations,
        stats: { planned, done, confirmed, overdueCount, totalOpen, checkins },
        kpi: kpi ? { visitTarget: kpi.visitTarget, visitActual: kpi.visitActual } : null,
      };
    });

    items.sort((a, b) => b.riskScore - a.riskScore);
    return { total: items.length, items };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  async dashboard() {
    const [agencyResult, saleResult] = await Promise.all([
      this.agencyRisks('200'),
      this.salesRisks(),
    ]);

    const agencyByLevel = { critical: 0, high: 0, medium: 0, low: 0 };
    agencyResult.items.forEach(a => { agencyByLevel[a.riskLevel as RiskLevel]++; });

    const saleByLevel = { critical: 0, high: 0, medium: 0, low: 0 };
    saleResult.items.forEach(s => { saleByLevel[s.riskLevel as RiskLevel]++; });

    const topAgencies = agencyResult.items.slice(0, 8);
    const topSales = saleResult.items.slice(0, 6);

    // Build AI recommendations
    const recommendations: string[] = [];
    const criticalAgencies = agencyResult.items.filter(a => a.riskLevel === 'critical');
    if (criticalAgencies.length) {
      recommendations.push(`Agency ${criticalAgencies.length} ราย อยู่ในสถานะ Critical — ต้องการความสนใจทันที`);
    }
    const noVisit45 = agencyResult.items.filter(a => (a.daysSinceLastVisit ?? 0) > 45);
    if (noVisit45.length) {
      recommendations.push(`Agency VIP ${noVisit45.length} ราย ไม่ได้รับการเยี่ยมเกิน 45 วัน ควรเพิ่ม Priority`);
    }
    const heavyTask = saleResult.items.filter(s => s.stats.overdueCount > 20);
    if (heavyTask.length) {
      recommendations.push(`Sale ${heavyTask.length} คน มีงานค้างเกิน 20 งาน ควรปรับตารางงานใหม่`);
    }
    const lowKpi = saleResult.items.filter(s => s.kpi && (s.kpi.visitTarget ?? 0) > 0 && (s.kpi.visitActual ?? 0) / (s.kpi.visitTarget ?? 1) < 0.6);
    if (lowKpi.length) {
      recommendations.push(`Sale ${lowKpi.length} คน KPI Site Visit ต่ำกว่า 60% ควรเร่งวางแผน`);
    }

    return {
      agencies: { ...agencyByLevel, total: agencyResult.total },
      sales: { ...saleByLevel, total: saleResult.total },
      topRiskAgencies: topAgencies,
      topRiskSales: topSales,
      recommendations,
    };
  }
}
