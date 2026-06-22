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

  // ตารางของฉัน (เซลส์/closer ดูงานตัวเอง) — วันนี้ + เป้าเดือน
  async myDay(userId: string, dateStr?: string) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return { error: 'บัญชีนี้ไม่ผูกกับพนักงาน' };
    const n = dateStr ? new Date(dateStr) : new Date();
    const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    const { y, m, gte, lt } = this.ym();
    const [today, plan, doneCount, assigned] = await Promise.all([
      this.prisma.dailySchedule.findUnique({
        where: { employeeId_date: { employeeId: emp.id, date } },
        include: { items: { include: { agency: { select: { name: true, zone: true, latitude: true, longitude: true } } }, orderBy: { startTime: 'asc' } } },
      }),
      this.prisma.monthlyPlan.findUnique({ where: { employeeId_year_month: { employeeId: emp.id, year: y, month: m } } }),
      this.prisma.visitPlan.count({ where: { employeeId: emp.id, status: 'done', planDate: { gte, lt } } }),
      this.prisma.agencyAssignment.count({ where: { employeeId: emp.id, isActive: true } }),
    ]);
    return {
      employee: { id: emp.id, name: emp.name, code: emp.code, position: emp.position },
      date: date.toISOString().slice(0, 10),
      today,
      month: {
        year: y,
        month: m,
        assigned,
        visitTarget: plan?.visitTarget ?? assigned * RULES.VISITS_PER_AGENCY,
        visitDone: doneCount,
        newAgencyTarget: plan?.newAgencyTarget ?? RULES.NEW_AGENCY_TARGET,
        workDayTarget: plan?.workDayTarget ?? RULES.WORK_DAYS,
      },
    };
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

  // ===== กฎ 1+2+7+8: AI auto-scheduler สร้างแผนทั้งเดือน =====
  async generateMonth(year?: number, month?: number) {
    const { y, m, gte, lt } = this.ym(year, month);
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

    // ล้างแผนเดิมของเดือนนี้
    await this.prisma.dailySchedule.deleteMany({ where: { date: { gte, lt } } });

    let totalVisitItems = 0;
    const coveredAgency = new Set<string>();

    // สร้างคิวเยี่ยมต่อเซลส์ (agency ละ VISITS_PER_AGENCY ครั้ง)
    for (let si = 0; si < sales.length; si++) {
      const s = sales[si];
      const queue: string[] = [];
      for (let r = 0; r < RULES.VISITS_PER_AGENCY; r++) {
        for (const a of s.assignments) queue.push(a.agencyId);
      }
      let qi = 0;
      for (let di = 0; di < workdays.length; di++) {
        const date = workdays[di].date;
        // หมุนเวร: เซลส์คนที่ (di % sales.length) อยู่ออฟฟิศวันนั้น
        const inOffice = di % sales.length === si;
        const schedule = await this.prisma.dailySchedule.create({
          data: { employeeId: s.id, date, inOffice, status: 'planned' },
        });
        const items: {
          scheduleId: string;
          type: any;
          title: string;
          agencyId?: string;
          startTime?: string;
          endTime?: string;
        }[] = [];
        items.push({ scheduleId: schedule.id, type: 'meeting', title: 'ประชุมทีมเช้า', startTime: '09:00', endTime: '09:30' });
        if (inOffice) {
          items.push({ scheduleId: schedule.id, type: 'office', title: 'อยู่ประจำออฟฟิศ + ติดตามงาน', startTime: '09:30', endTime: '17:00' });
        } else {
          // ใส่เยี่ยมตามเพดาน/วัน
          let slot = 10;
          for (let v = 0; v < RULES.VISITS_PER_DAY && qi < queue.length; v++) {
            const agencyId = queue[qi++];
            coveredAgency.add(agencyId);
            const hh = String(slot).padStart(2, '0');
            items.push({
              scheduleId: schedule.id,
              type: 'visit',
              title: 'เข้าเยี่ยม agency',
              agencyId,
              startTime: `${hh}:00`,
              endTime: `${hh}:45`,
            });
            slot++;
            if (slot === 12) slot = 13; // พักเที่ยง
            totalVisitItems++;
          }
          items.push({ scheduleId: schedule.id, type: 'report', title: 'บันทึกรายงาน', startTime: '16:00', endTime: '17:00' });
        }
        await this.prisma.dailyScheduleItem.createMany({ data: items });
      }
    }

    // closers: หมุนเวร 2 คน/วันอยู่ออฟฟิศ + งานติดตาม
    for (let di = 0; di < workdays.length; di++) {
      const date = workdays[di].date;
      for (let ci = 0; ci < closers.length; ci++) {
        const c = closers[ci];
        const inOffice = (ci - di) % closers.length === 0 || (ci - di + 1) % closers.length === 0; // 2 คน/วัน
        const schedule = await this.prisma.dailySchedule.create({
          data: { employeeId: c.id, date, inOffice, status: 'planned' },
        });
        await this.prisma.dailyScheduleItem.createMany({
          data: [
            { scheduleId: schedule.id, type: 'meeting', title: 'ประชุมทีมเช้า', startTime: '09:00', endTime: '09:30' },
            {
              scheduleId: schedule.id,
              type: inOffice ? 'office' : 'followup',
              title: inOffice ? 'ประจำออฟฟิศ + ดูแลคุณภาพงาน/ปิดดีล' : 'ออกช่วยปิดดีล/โค้ชเซลส์',
              startTime: '09:30',
              endTime: '17:00',
            },
          ],
        });
      }
    }

    const totalAgencies = sales.reduce((s, e) => s + e.assignments.length, 0);
    const fullyCovered = coveredAgency.size; // ที่จัดเยี่ยมได้อย่างน้อย 1 รอบ
    return {
      year: y,
      month: m,
      workdays: workdays.length,
      sales: sales.length,
      closers: closers.length,
      scheduledVisits: totalVisitItems,
      agenciesAssigned: totalAgencies,
      agenciesScheduled: fullyCovered,
      shortfall: Math.max(0, totalAgencies - fullyCovered),
      note:
        totalAgencies > fullyCovered
          ? `⚠️ กำลังคนปัจจุบันจัดเยี่ยมได้ ${fullyCovered}/${totalAgencies} ร้าน (เพดาน ${RULES.VISITS_PER_DAY} เยี่ยม/คน/วัน) — ควรเพิ่มเซลส์หรือลด agency/คน`
          : 'จัดแผนครบทุก agency',
    };
  }

  // ===== Automation Engine (กฎ 3+10) — เปิดด้วย SCHEDULER_ENABLED=true =====
  private enabled() {
    return this.config.get('SCHEDULER_ENABLED') === 'true';
  }

  @Cron('0 1 * * *', { timeZone: 'Asia/Bangkok' }) // วันที่ 1 สร้างแผนเดือน (เช็คในฟังก์ชัน)
  async monthlyAuto() {
    if (!this.enabled()) return;
    const now = new Date();
    if (now.getDate() === 1) {
      const r = await this.generateMonth();
      this.logger.log(`[วันที่1] สร้างแผนเดือน: ${JSON.stringify(r)}`);
    } else if (now.getDate() === 16) {
      const cov = await this.coverageStatus();
      this.logger.log(`[วันที่16] coverage กลางเดือน: ผ่าน ${cov.pass}/${cov.totalAgencies}`);
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
