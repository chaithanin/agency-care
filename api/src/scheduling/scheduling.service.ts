import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// กฎธุรกิจ (ปรับได้ผ่าน env)
const RULES = {
  VISITS_PER_AGENCY: 2, // ต้องเยี่ยม ≥2 ครั้ง/เดือน
  NEW_AGENCY_TARGET: 2, // เซลส์เพิ่ม agency ใหม่ /เดือน
  WORK_DAYS: 24,
  OFFICE_MIN_SALES: 1, // standby ออฟฟิศขั้นต่ำ/วัน
  OFFICE_MIN_CLOSER: 2,
  VISITS_PER_DAY: 3, // เยี่ยม 2-3 ร้าน/คน/วัน
  AGENCIES_PER_SALES: 30, // เซลส์ละ 30 ร้านศักยภาพ
};

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private ym(year?: number, month?: number) {
    const n = new Date();
    const y = year ?? n.getUTCFullYear();
    const m = month ?? n.getUTCMonth() + 1;
    const gte = new Date(Date.UTC(y, m - 1, 1));
    const lt = new Date(Date.UTC(y, m, 1));
    return { y, m, gte, lt };
  }

  // ===== กฎ 9 + 6: Team Dashboard =====
  async teamDashboard(year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
    const teams = await this.prisma.team.findMany({
      where: { isActive: true },
      include: { members: { where: { isActive: true }, select: { id: true, position: true } } },
    });
    // นับเยี่ยมที่ทำแล้ว (done) เดือนนี้ ต่อเซลส์
    const doneByEmp = await this.prisma.visitPlan.groupBy({
      by: ['employeeId'],
      where: { status: 'done', planDate: { gte, lt } },
      _count: { _all: true },
    });
    const doneMap = new Map(doneByEmp.map((d) => [d.employeeId, d._count._all]));
    // นับ agency ที่มอบหมายต่อเซลส์
    const assignByEmp = await this.prisma.agencyAssignment.groupBy({
      by: ['employeeId'],
      where: { isActive: true },
      _count: { _all: true },
    });
    const assignMap = new Map(assignByEmp.map((a) => [a.employeeId, a._count._all]));

    const rows = teams.map((t) => {
      const salesIds = t.members.filter((mb) => mb.position === 'sales').map((mb) => mb.id);
      const closerN = t.members.filter((mb) => mb.position === 'closer').length;
      const agencyN = salesIds.reduce((s, id) => s + (assignMap.get(id) || 0), 0);
      const visited = salesIds.reduce((s, id) => s + (doneMap.get(id) || 0), 0);
      const target = agencyN * RULES.VISITS_PER_AGENCY;
      return {
        teamId: t.id,
        code: t.code,
        name: t.name,
        zone: t.zone,
        sales: salesIds.length,
        closer: closerN,
        agencies: agencyN,
        visitTarget: target,
        visited,
        remaining: Math.max(0, target - visited),
        progressPct: target ? Math.round((visited / target) * 100) : 0,
      };
    });
    return { year: y, month: m, rules: RULES, teams: rows };
  }

  // ===== กฎ 2: coverage — agency เยี่ยมครบ 2x หรือยัง =====
  async coverageStatus(year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
    const done = await this.prisma.visitPlan.groupBy({
      by: ['agencyId'],
      where: { status: 'done', planDate: { gte, lt } },
      _count: { _all: true },
    });
    const totalAgencies = await this.prisma.agency.count({ where: { status: 'active' } });
    let two = 0,
      one = 0;
    for (const d of done) {
      if (d._count._all >= RULES.VISITS_PER_AGENCY) two++;
      else if (d._count._all === 1) one++;
    }
    const zero = totalAgencies - two - one;
    return {
      year: y,
      month: m,
      totalAgencies,
      pass: two, // ครบ ≥2
      partial: one, // เยี่ยม 1 ครั้ง (ขาดอีก 1)
      none: zero, // ยังไม่ถูกเยี่ยม (สำคัญสุด)
      coveragePct: totalAgencies ? Math.round((two / totalAgencies) * 100) : 0,
    };
  }

  // ===== กฎ 7: office presence — คนประจำออฟฟิศพอไหม =====
  async officeStatus(dateStr?: string) {
    const n = dateStr ? new Date(dateStr) : new Date();
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const schedules = await this.prisma.dailySchedule.findMany({
      where: { date, inOffice: true },
      include: { employee: { select: { id: true, name: true, position: true } } },
    });
    const inSales = schedules.filter((s) => s.employee.position === 'sales');
    const inCloser = schedules.filter((s) => s.employee.position === 'closer');
    const ok = inSales.length >= RULES.OFFICE_MIN_SALES && inCloser.length >= RULES.OFFICE_MIN_CLOSER;
    return {
      date: date.toISOString().slice(0, 10),
      need: { sales: RULES.OFFICE_MIN_SALES, closer: RULES.OFFICE_MIN_CLOSER },
      inOffice: {
        sales: inSales.map((s) => s.employee.name),
        closer: inCloser.map((s) => s.employee.name),
      },
      ok,
      warning: ok ? null : 'คนประจำออฟฟิศไม่พอตามกฎ (ขั้นต่ำ 1 sales + 2 closer)',
    };
  }

  // ===== กฎ 5: เซลส์เพิ่ม agency ใหม่ครบเป้าไหม =====
  async newAgencyStatus(year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
    const sales = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      select: { id: true, name: true, code: true },
    });
    const added = await this.prisma.agency.groupBy({
      by: ['addedById'],
      where: { createdAt: { gte, lt }, addedById: { not: null } },
      _count: { _all: true },
    });
    const addedMap = new Map(added.map((a) => [a.addedById!, a._count._all]));
    const plans = await this.prisma.monthlyPlan.findMany({ where: { year: y, month: m } });
    const planMap = new Map(plans.map((p) => [p.employeeId, p.newAgencyTarget]));
    const rows = sales.map((s) => {
      const target = planMap.get(s.id) ?? RULES.NEW_AGENCY_TARGET;
      const actual = addedMap.get(s.id) || 0;
      return {
        employeeId: s.id,
        name: s.name,
        code: s.code,
        target,
        actual,
        remaining: Math.max(0, target - actual),
        ok: actual >= target,
      };
    });
    return { year: y, month: m, rows };
  }

  // ===== กฎ 4: agency พบเซลส์ ≥1/เดือน (ร้านที่ยังไม่พบ = แจ้งเตือน) =====
  async unmetAgencies(year?: number, month?: number, take = 50) {
    const { y, m, gte, lt } = this.ym(year, month);
    const metIds = await this.prisma.visitPlan.findMany({
      where: { status: 'done', planDate: { gte, lt } },
      select: { agencyId: true },
      distinct: ['agencyId'],
    });
    const met = new Set(metIds.map((x) => x.agencyId));
    const all = await this.prisma.agency.findMany({
      where: { status: 'active' },
      select: { id: true, code: true, name: true, zone: true },
      orderBy: { code: 'asc' },
    });
    const unmet = all.filter((a) => !met.has(a.id));
    return {
      year: y,
      month: m,
      metCount: met.size,
      unmetCount: unmet.length,
      sample: unmet.slice(0, take),
    };
  }

  // ===== แผนรายวัน (กฎ 8) =====
  async dailySchedules(dateStr: string, employeeId?: string) {
    const n = new Date(dateStr);
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    return this.prisma.dailySchedule.findMany({
      where: { date, ...(employeeId ? { employeeId } : {}) },
      include: {
        employee: { select: { id: true, name: true, code: true, position: true } },
        items: { include: { agency: { select: { name: true, zone: true } } }, orderBy: { startTime: 'asc' } },
      },
      orderBy: { employee: { code: 'asc' } },
    });
  }

  // ตารางของฉัน (เซลส์/closer) — VisitPlan วันนี้ (เช็คอินได้) จัดลำดับ route + เป้าเดือน
  async myDay(userId: string, dateStr?: string) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return { error: 'บัญชีนี้ไม่ผูกกับพนักงาน' };
    const n = dateStr ? new Date(dateStr) : new Date();
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const { y, m, gte, lt } = this.ym();
    const [plansToday, standby, plan, doneCount, plannedCount, assigned] = await Promise.all([
      this.prisma.visitPlan.findMany({
        where: { employeeId: emp.id, planDate: date },
        include: {
          agency: { select: { name: true, zone: true, latitude: true, longitude: true, phone: true } },
          checkin: { select: { id: true, checkOutAt: true } },
        },
      }),
      this.prisma.dailySchedule.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } }),
      this.prisma.monthlyPlan.findUnique({ where: { employeeId_year_month: { employeeId: emp.id, year: y, month: m } } }),
      this.prisma.visitPlan.count({ where: { employeeId: emp.id, status: 'done', planDate: { gte, lt } } }),
      this.prisma.visitPlan.count({ where: { employeeId: emp.id, planDate: { gte, lt } } }),
      this.prisma.agencyAssignment.count({ where: { employeeId: emp.id, isActive: true } }),
    ]);
    // จัดลำดับ route แบบ nearest-neighbor + ใส่เวลานัด
    const ordered = this.orderByRoute(plansToday);
    const slots = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    const items = ordered.map((p, i) => ({
      visitPlanId: p.id,
      time: slots[i] ?? '',
      agencyName: p.agency.name,
      zone: p.agency.zone,
      phone: p.agency.phone,
      status: p.status,
      checkedIn: !!p.checkin,
      checkedOut: !!p.checkin?.checkOutAt,
    }));
    return {
      employee: { id: emp.id, name: emp.name, code: emp.code, position: emp.position },
      date: date.toISOString().slice(0, 10),
      inOffice: !!standby?.inOffice,
      visits: items,
      month: {
        year: y, month: m, assigned,
        visitTarget: plannedCount || plan?.visitTarget || assigned * RULES.VISITS_PER_AGENCY,
        visitDone: doneCount,
        newAgencyTarget: plan?.newAgencyTarget ?? RULES.NEW_AGENCY_TARGET,
      },
    };
  }

  // จัดลำดับเดินทาง nearest-neighbor (ลดเวลาวิ่งรถ)
  private orderByRoute<T extends { agency: { latitude: number | null; longitude: number | null } }>(plans: T[]): T[] {
    const withGps = plans.filter((p) => p.agency.latitude != null && p.agency.longitude != null);
    const noGps = plans.filter((p) => p.agency.latitude == null);
    if (withGps.length <= 2) return [...withGps, ...noGps];
    const result: T[] = [];
    const pool = [...withGps];
    let cur = pool.shift()!;
    result.push(cur);
    const dist = (a: T, b: T) =>
      Math.hypot((a.agency.latitude! - b.agency.latitude!), (a.agency.longitude! - b.agency.longitude!));
    while (pool.length) {
      let bi = 0;
      for (let i = 1; i < pool.length; i++) if (dist(cur, pool[i]) < dist(cur, pool[bi])) bi = i;
      cur = pool.splice(bi, 1)[0];
      result.push(cur);
    }
    return [...result, ...noGps];
  }

  // จัดการทีม + พนักงาน (สำหรับหน้า admin)
  async teams() {
    return this.prisma.team.findMany({
      include: {
        members: {
          where: { isActive: true },
          select: { id: true, name: true, code: true, position: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  // ===== Seller Performance Dashboard (ตาม mockup) =====
  async sellerPerformance(employeeId?: string, year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
    const sellers = await this.prisma.employee.findMany({
      where: { isActive: true, position: { in: ['sales', 'closer'] } },
      select: { id: true, name: true, code: true, position: true, inTraining: true, team: { select: { name: true } } },
      orderBy: [{ position: 'asc' }, { code: 'asc' }],
    });
    if (!sellers.length) return { sellers: [], selected: null };
    const sel = sellers.find((s) => s.id === employeeId) ?? sellers.find((s) => s.position === 'sales') ?? sellers[0];

    // รวมตัวเลขทุกเซลส์ (leaderboard)
    const [doneByEmp, assignByEmp, addedByEmp, plans] = await Promise.all([
      this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { status: 'done', planDate: { gte, lt } }, _count: { _all: true } }),
      this.prisma.agencyAssignment.groupBy({ by: ['employeeId'], where: { isActive: true }, _count: { _all: true } }),
      this.prisma.agency.groupBy({ by: ['addedById'], where: { createdAt: { gte, lt }, addedById: { not: null } }, _count: { _all: true } }),
      this.prisma.monthlyPlan.findMany({ where: { year: y, month: m } }),
    ]);
    const doneMap = new Map(doneByEmp.map((d) => [d.employeeId, d._count._all]));
    const assignMap = new Map(assignByEmp.map((a) => [a.employeeId, a._count._all]));
    const addedMap = new Map(addedByEmp.map((a) => [a.addedById!, a._count._all]));
    const planMap = new Map(plans.map((p) => [p.employeeId, p]));

    const leaderboard = sellers
      .filter((s) => s.position === 'sales')
      .map((s) => ({
        employeeId: s.id,
        name: s.name,
        visitsDone: doneMap.get(s.id) || 0,
        agencies: assignMap.get(s.id) || 0,
        newAgencies: addedMap.get(s.id) || 0,
        me: s.id === sel.id,
      }))
      .sort((a, b) => b.visitsDone - a.visitsDone)
      .map((r, i) => ({ rank: i + 1, ...r }));

    // KPI ของคนที่เลือก
    const plan = planMap.get(sel.id);
    const visitsDone = doneMap.get(sel.id) || 0;
    const agencies = assignMap.get(sel.id) || 0;
    const visitTarget = plan?.visitTarget ?? agencies * RULES.VISITS_PER_AGENCY;
    const newAgencies = addedMap.get(sel.id) || 0;
    const newAgencyTarget = plan?.newAgencyTarget ?? RULES.NEW_AGENCY_TARGET;

    // coverage (pipeline) เฉพาะร้านของคนนี้
    const myAgencyIds = (
      await this.prisma.agencyAssignment.findMany({ where: { employeeId: sel.id, isActive: true }, select: { agencyId: true } })
    ).map((a) => a.agencyId);
    const doneByAgency = await this.prisma.visitPlan.groupBy({
      by: ['agencyId'],
      where: { agencyId: { in: myAgencyIds }, status: 'done', planDate: { gte, lt } },
      _count: { _all: true },
    });
    let pass = 0, partial = 0;
    for (const d of doneByAgency) {
      if (d._count._all >= RULES.VISITS_PER_AGENCY) pass++;
      else if (d._count._all === 1) partial++;
    }
    const pipeline = { pass, partial, none: agencies - pass - partial, total: agencies };

    // ตารางสัปดาห์นี้ (จ-ส)
    const ref = new Date();
    const dow = (ref.getUTCDay() + 6) % 7; // จ=0
    const monday = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - dow));
    const todayStr = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate())).toISOString().slice(0, 10);
    const weekDates = Array.from({ length: 6 }, (_, i) => new Date(monday.getTime() + i * 86400000));
    const weekPlans = await this.prisma.visitPlan.findMany({
      where: { employeeId: sel.id, planDate: { gte: weekDates[0], lte: weekDates[5] } },
      include: { agency: { select: { name: true } } },
    });
    const plansByDate = new Map<string, typeof weekPlans>();
    for (const p of weekPlans) {
      const ds = p.planDate.toISOString().slice(0, 10);
      const arr = plansByDate.get(ds) ?? [];
      arr.push(p);
      plansByDate.set(ds, arr);
    }
    const dayNames = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const week = weekDates.map((d, i) => {
      const ds = d.toISOString().slice(0, 10);
      const dayPlans = plansByDate.get(ds) ?? [];
      return {
        label: dayNames[i],
        date: ds.slice(8),
        today: ds === todayStr,
        inOffice: false,
        items: dayPlans.map((p) => ({
          name: p.agency.name,
          status: p.status === 'done' ? 'done' : ds < todayStr ? 'miss' : 'plan',
        })),
      };
    });

    return {
      sellers,
      selected: { id: sel.id, name: sel.name, code: sel.code, position: sel.position, inTraining: sel.inTraining, team: sel.team?.name ?? null },
      month: { year: y, month: m },
      kpis: {
        visitsDone,
        visitTarget,
        completionPct: visitTarget ? Math.round((visitsDone / visitTarget) * 100) : 0,
        agencies,
        newAgencies,
        newAgencyTarget,
      },
      pipeline,
      week,
      leaderboard,
    };
  }

  // ความถี่เยี่ยม/เดือน ตาม tier ของ agency
  private tierFreq(tier: string, month: number): number {
    switch (tier) {
      case 'platinum': return 4;
      case 'gold': return 2;
      case 'silver': return 1;
      case 'bronze': return month % 2 === 0 ? 1 : 0; // 1 ครั้ง/2 เดือน
      case 'new': return 2;
      default: return 2;
    }
  }

  // ===== AI auto-scheduler — สร้าง VisitPlan (เช็คอินได้จริง) =====
  async generateMonth(year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
    return this._generate(gte, lt, 1, y, m);
  }

  // วางแผนราย 2 สัปดาห์ (bi-weekly) — ครึ่งความถี่เดือน
  async generateFortnight(fromStr?: string) {
    const f = fromStr ? new Date(fromStr) : new Date();
    const gte = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
    const lt = new Date(gte.getTime() + 14 * 86400000);
    return this._generate(gte, lt, 0.5, gte.getUTCFullYear(), gte.getUTCMonth() + 1);
  }

  private async _generate(gte: Date, lt: Date, scale: number, y: number, m: number) {
    const workdays = await this.prisma.workCalendar.findMany({
      where: { date: { gte, lt }, isHoliday: false },
      orderBy: { date: 'asc' },
    });
    if (!workdays.length) return { error: `ไม่มีวันทำงานในปฏิทิน ${y}-${m} (seed ปฏิทินก่อน)` };

    const sales = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      include: { assignments: { where: { isActive: true }, select: { agencyId: true } } },
      orderBy: { code: 'asc' },
    });
    const closers = await this.prisma.employee.findMany({
      where: { position: 'closer', isActive: true },
      orderBy: { code: 'asc' },
    });
    const allEmpIds = [...sales, ...closers].map((e) => e.id);
    // tier ของทุก agency
    const tierMap = new Map(
      (await this.prisma.agency.findMany({ where: { status: 'active' }, select: { id: true, tier: true } })).map((a) => [a.id, a.tier]),
    );

    // ล้างแผนเดิมในช่วง: VisitPlan ที่ยัง pending (เก็บที่ done ไว้) + DailySchedule
    await this.prisma.visitPlan.deleteMany({
      where: { employeeId: { in: allEmpIds }, status: 'pending', planDate: { gte, lt } },
    });
    await this.prisma.dailySchedule.deleteMany({ where: { date: { gte, lt }, employeeId: { in: allEmpIds } } });

    const visitPlans: { agencyId: string; employeeId: string; planDate: Date; note: string }[] = [];
    const standby: { employeeId: string; date: Date }[] = [];
    const coveredAgency = new Set<string>();
    let totalAgencies = 0;

    for (let si = 0; si < sales.length; si++) {
      const s = sales[si];
      totalAgencies += s.assignments.length;
      // คิวเยี่ยมตาม tier — interleave เป็นรอบ (ครั้งของร้านเดียวกันจะห่างกัน ~ครึ่งเดือน ไม่ซ้ำวันเดียว)
      const freqs = s.assignments.map((a) => ({
        id: a.agencyId,
        f: Math.max(0, Math.round(this.tierFreq(tierMap.get(a.agencyId) ?? 'gold', m) * scale)),
      }));
      const maxF = freqs.reduce((mx, a) => Math.max(mx, a.f), 0);
      const queue: string[] = [];
      for (let r = 0; r < maxF; r++) for (const a of freqs) if (r < a.f) queue.push(a.id);
      let qi = 0;
      for (let di = 0; di < workdays.length; di++) {
        const date = workdays[di].date;
        if (di % sales.length === si) {
          // วัน standby ประจำออฟฟิศ — ไม่จัดเยี่ยม
          standby.push({ employeeId: s.id, date });
          continue;
        }
        for (let v = 0; v < RULES.VISITS_PER_DAY && qi < queue.length; v++) {
          const agencyId = queue[qi++];
          coveredAgency.add(agencyId);
          visitPlans.push({ agencyId, employeeId: s.id, planDate: date, note: 'AI auto-plan' });
        }
      }
    }

    // closers: หมุนเวร 2 คน/วัน standby
    for (let di = 0; di < workdays.length; di++) {
      for (let ci = 0; ci < closers.length; ci++) {
        const inOffice = (((ci - di) % closers.length) + closers.length) % closers.length < 2;
        if (inOffice) standby.push({ employeeId: closers[ci].id, date: workdays[di].date });
      }
    }

    if (visitPlans.length) await this.prisma.visitPlan.createMany({ data: visitPlans });
    if (standby.length)
      await this.prisma.dailySchedule.createMany({
        data: standby.map((s) => ({ employeeId: s.employeeId, date: s.date, inOffice: true, status: 'planned' })),
        skipDuplicates: true,
      });

    return {
      year: y,
      month: m,
      workdays: workdays.length,
      sales: sales.length,
      closers: closers.length,
      scheduledVisits: visitPlans.length,
      agenciesAssigned: totalAgencies,
      agenciesScheduled: coveredAgency.size,
      shortfall: Math.max(0, totalAgencies - coveredAgency.size),
      note:
        totalAgencies > coveredAgency.size
          ? `⚠️ จัดเยี่ยมได้ ${coveredAgency.size}/${totalAgencies} ร้าน (เพดาน ${RULES.VISITS_PER_DAY}/คน/วัน) — เพิ่มเซลส์หรือลดร้าน/คน`
          : 'จัดแผนครบทุก agency',
    };
  }

  // ===== Dashboard รายเดือน (ต่อเซลส์) =====
  async monthlyDashboard(year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
    const sales = await this.prisma.employee.findMany({
      where: { position: 'sales', isActive: true },
      select: { id: true, name: true, code: true, inTraining: true, team: { select: { name: true } } },
      orderBy: { code: 'asc' },
    });
    const [planned, done, assign] = await Promise.all([
      this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { planDate: { gte, lt } }, _count: { _all: true } }),
      this.prisma.visitPlan.groupBy({ by: ['employeeId'], where: { status: 'done', planDate: { gte, lt } }, _count: { _all: true } }),
      this.prisma.agencyAssignment.groupBy({ by: ['employeeId'], where: { isActive: true }, _count: { _all: true } }),
    ]);
    const pMap = new Map(planned.map((x) => [x.employeeId, x._count._all]));
    const dMap = new Map(done.map((x) => [x.employeeId, x._count._all]));
    const aMap = new Map(assign.map((x) => [x.employeeId, x._count._all]));
    const rows = sales.map((s) => {
      const target = pMap.get(s.id) || 0;
      const visited = dMap.get(s.id) || 0;
      const remaining = Math.max(0, target - visited);
      const pct = target ? Math.round((visited / target) * 100) : 0;
      const status = pct >= 90 ? 'green' : pct >= 50 ? 'yellow' : 'red';
      return {
        employeeId: s.id, name: s.name, code: s.code, team: s.team?.name ?? null, inTraining: s.inTraining,
        agencies: aMap.get(s.id) || 0, target, visited, remaining, pct, status,
      };
    });
    return { year: y, month: m, rows };
  }

  // ===== Manager real-time: เซลส์อยู่ไหนตอนนี้ =====
  async liveStatus() {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sales = await this.prisma.employee.findMany({
      where: { position: { in: ['sales', 'closer'] }, isActive: true },
      select: { id: true, name: true, position: true },
      orderBy: { code: 'asc' },
    });
    const todayPlans = await this.prisma.visitPlan.findMany({
      where: { planDate: startOfDay },
      include: {
        agency: { select: { name: true } },
        checkin: { select: { checkinAt: true, checkOutAt: true } },
      },
    });
    const byEmp = new Map<string, typeof todayPlans>();
    for (const p of todayPlans) {
      const arr = byEmp.get(p.employeeId) ?? [];
      arr.push(p);
      byEmp.set(p.employeeId, arr);
    }
    const rows = sales.map((s) => {
      const plans = byEmp.get(s.id) ?? [];
      const total = plans.length;
      const done = plans.filter((p) => p.status === 'done').length;
      const active = plans.find((p) => p.checkin && !p.checkin.checkOutAt);
      let state: string, detail: string;
      if (active) { state = 'green'; detail = `🟢 อยู่ที่ ${active.agency.name}`; }
      else if (total === 0) { state = 'gray'; detail = 'ไม่มีนัดวันนี้'; }
      else if (done >= total) { state = 'blue'; detail = `เสร็จครบ ${done}/${total}`; }
      else { state = 'yellow'; detail = `เยี่ยมแล้ว ${done}/${total}`; }
      return { employeeId: s.id, name: s.name, position: s.position, state, detail, total, done };
    });
    return { at: now.toISOString(), rows };
  }

  // ===== Automation Engine (กฎ 3+10) — เปิดด้วย SCHEDULER_ENABLED=true =====
  private enabled() {
    return this.config.get('SCHEDULER_ENABLED') === 'true';
  }

  @Cron('0 1 * * *', { timeZone: 'Asia/Bangkok' }) // วางแผนราย 2 สัปดาห์ (วันที่ 1 และ 16)
  async biweeklyAuto() {
    if (!this.enabled()) return;
    const now = new Date();
    if (now.getDate() === 1 || now.getDate() === 16) {
      const r = await this.generateFortnight();
      const cov = await this.coverageStatus();
      this.logger.log(
        `[วันที่${now.getDate()}] วางแผน 2 สัปดาห์: ${JSON.stringify(r)} · coverage ผ่าน ${cov.pass}/${cov.totalAgencies}`,
      );
    }
  }

  @Cron('0 17 * * *', { timeZone: 'Asia/Bangkok' }) // 17:00 ตรวจ GPS/รูป + ปิดงานวัน
  async eveningCheck() {
    if (!this.enabled()) return;
    const office = await this.officeStatus();
    if (!office.ok) this.logger.warn(`[17:00] ${office.warning}`);
    // ปิดงานวันนี้
    const n = new Date();
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    await this.prisma.dailySchedule.updateMany({ where: { date }, data: { status: 'done' } });
  }
}
