import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotoPhase, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, UploadFile } from '../storage/storage.service';
import { RequestUser } from '../common/current-user.decorator';
import { CheckinDto, CreatePlanDto, ReportDto, UpdatePlanStatusDto } from './dto/visit.dto';

// ระยะทาง 2 พิกัด (เมตร) — Haversine
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

@Injectable()
export class VisitService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  // รัศมี 3 ระดับ: ≤pass ผ่าน, ≤warn แจ้งเตือน, >warn ไม่อนุญาต
  private get passRadius(): number {
    return Number(this.config.get('CHECKIN_PASS_RADIUS_METERS', 100));
  }
  private get warnRadius(): number {
    return Number(this.config.get('CHECKIN_WARN_RADIUS_METERS', 300));
  }

  // หา employee ของ user ที่ login (เซลส์)
  private async requireEmployee(userId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) throw new ForbiddenException('บัญชีนี้ไม่ได้ผูกกับพนักงานเซลส์');
    return emp;
  }

  // ---- Visit Plans ----
  async createPlan(dto: CreatePlanDto) {
    const [agency, employee] = await Promise.all([
      this.prisma.agency.findUnique({ where: { id: dto.agencyId } }),
      this.prisma.employee.findUnique({ where: { id: dto.employeeId } }),
    ]);
    if (!agency) throw new NotFoundException('ไม่พบ Agency');
    if (!employee) throw new NotFoundException('ไม่พบพนักงาน');

    const baseData = {
      agencyId: dto.agencyId,
      employeeId: dto.employeeId,
      note: dto.note,
      actionType: dto.actionType,
      requestDetails: dto.requestDetails,
      priority: dto.priority ?? 'medium',
      isRecurring: dto.isRecurring ?? false,
      recurringFreq: dto.recurringFreq,
      recurringUntil: dto.recurringUntil ? new Date(dto.recurringUntil) : undefined,
    };

    if (!dto.isRecurring || !dto.recurringFreq || !dto.recurringUntil) {
      return this.prisma.visitPlan.create({
        data: { ...baseData, planDate: new Date(dto.planDate) },
      });
    }

    // Build recurring dates
    const dates: Date[] = [];
    const until = new Date(dto.recurringUntil);
    let cur = new Date(dto.planDate);
    while (cur <= until) {
      dates.push(new Date(cur));
      if (dto.recurringFreq === 'weekly') cur.setDate(cur.getDate() + 7);
      else cur.setMonth(cur.getMonth() + 1); // monthly
    }

    await this.prisma.visitPlan.createMany({
      data: dates.map((d) => ({ ...baseData, planDate: d })),
      skipDuplicates: true,
    });
    return { created: dates.length };
  }

  // list ตามช่วงวัน/เซลส์ — admin เห็นหมด, sales เห็นเฉพาะตัวเอง
  async listPlans(user: RequestUser, params: { date?: string; from?: string; to?: string; employeeId?: string; actionType?: string; status?: string }) {
    const where: Prisma.VisitPlanWhereInput = {};

    if (user.activeRole === 'sales') {
      const emp = await this.requireEmployee(user.id);
      where.employeeId = emp.id;
    } else if (params.employeeId) {
      where.employeeId = params.employeeId;
    }

    if (params.date) {
      where.planDate = new Date(params.date);
    } else if (params.from || params.to) {
      where.planDate = {};
      if (params.from) (where.planDate as Prisma.DateTimeFilter).gte = new Date(params.from);
      if (params.to) (where.planDate as Prisma.DateTimeFilter).lte = new Date(params.to);
    }
    if (params.actionType) where.actionType = params.actionType;
    if (params.status) where.status = params.status as any;

    return this.prisma.visitPlan.findMany({
      where,
      orderBy: [{ planDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        agency: { select: { id: true, code: true, name: true, phone: true, latitude: true, longitude: true, zone: true } },
        employee: { select: { id: true, code: true, name: true } },
        checkin: { select: { id: true, checkinAt: true, withinRadius: true, distanceMeters: true } },
        report: { select: { id: true, summary: true } },
      },
    });
  }

  async getPlan(user: RequestUser, id: string) {
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id },
      include: {
        agency: true,
        employee: { select: { id: true, code: true, name: true } },
        checkin: { include: { photos: true } },
        report: true,
        workPhotos: { orderBy: { takenAt: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('ไม่พบแผนการเยี่ยม');
    if (user.activeRole === 'sales') {
      const emp = await this.requireEmployee(user.id);
      if (plan.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
    }
    return plan;
  }

  async updateStatus(user: RequestUser, id: string, dto: UpdatePlanStatusDto) {
    const plan = await this.getPlan(user, id);
    return this.prisma.visitPlan.update({
      where: { id: plan.id },
      data: { status: dto.status, note: dto.note ?? plan.note },
    });
  }

  // ---- เลื่อนการเข้าพบ (พร้อมเหตุผล) ----
  async reschedule(user: RequestUser, id: string, dto: import('./dto/visit.dto').RescheduleDto) {
    const plan = await this.getPlan(user, id);
    if (plan.checkin) throw new BadRequestException('เยี่ยมไปแล้ว เลื่อนไม่ได้');
    const stamp = `[เลื่อนนัด ${new Date().toISOString().slice(0, 10)}] ${dto.reason}`;
    const note = plan.note ? `${plan.note}\n${stamp}` : stamp;
    return this.prisma.visitPlan.update({
      where: { id: plan.id },
      data: {
        note,
        // มีวันใหม่ = เลื่อนไปวันนั้น (pending), ไม่มี = postponed
        ...(dto.newDate ? { planDate: new Date(dto.newDate), status: 'pending' } : { status: 'postponed' }),
      },
    });
  }

  // ---- อัปโหลดรูปการทำงาน (ไม่ต้อง check-in) ----
  async addWorkPhoto(
    user: RequestUser,
    planId: string,
    file: UploadFile,
    caption?: string,
    coords?: { latitude?: number; longitude?: number },
  ) {
    const plan = await this.getPlan(user, planId);
    const url = await this.storage.save(file);
    return this.prisma.visitWorkPhoto.create({
      data: { visitPlanId: plan.id, url, caption, latitude: coords?.latitude, longitude: coords?.longitude },
    });
  }

  // ---- Check-in (GPS 3 ระดับ + กันปลอม) ----
  async checkin(
    user: RequestUser,
    planId: string,
    dto: CheckinDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const emp = await this.requireEmployee(user.id);
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id: planId },
      include: { agency: true, checkin: true },
    });
    if (!plan) throw new NotFoundException('ไม่พบแผนการเยี่ยม');
    if (plan.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
    if (plan.checkin) throw new BadRequestException('แผนนี้ check-in ไปแล้ว');
    if (plan.agency.latitude == null || plan.agency.longitude == null) {
      throw new BadRequestException('Agency ยังไม่ได้ตั้งพิกัด GPS — ติดต่อแอดมิน');
    }

    // กันเช็กอินซ้ำร้านเดิมในวันเดียวกัน
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dup = await this.prisma.visitCheckin.findFirst({
      where: {
        employeeId: emp.id,
        checkinAt: { gte: startOfDay },
        visitPlan: { agencyId: plan.agencyId },
      },
    });
    if (dup) throw new BadRequestException('คุณเช็กอินร้านนี้ไปแล้ววันนี้');

    const dist = distanceMeters(dto.latitude, dto.longitude, plan.agency.latitude, plan.agency.longitude);
    // 3 ระดับ
    let gpsStatus: 'in_area' | 'near' | 'out';
    if (dist <= this.passRadius) gpsStatus = 'in_area';
    else if (dist <= this.warnRadius) gpsStatus = 'near';
    else gpsStatus = 'out';
    if (gpsStatus === 'out') {
      throw new BadRequestException(
        `อยู่ห่างจาก Agency ${dist} เมตร (เกิน ${this.warnRadius} เมตร) — ไม่อนุญาตให้ check-in`,
      );
    }

    const checkin = await this.prisma.visitCheckin.create({
      data: {
        visitPlanId: plan.id,
        employeeId: emp.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        distanceMeters: dist,
        withinRadius: gpsStatus === 'in_area',
        gpsStatus,
        accuracyMeters: dto.accuracy,
        isMockGps: dto.isMock ?? false,
        contactName: dto.contactName,
        contactPosition: dto.contactPosition,
        contactPhone: dto.contactPhone,
        deviceInfo: meta?.userAgent?.slice(0, 300),
        ipAddress: meta?.ip,
      },
    });
    await this.prisma.visitPlan.update({ where: { id: plan.id }, data: { status: 'done' } });
    const warn = gpsStatus === 'near' ? ' (⚠️ ใกล้เคียง นอกรัศมีแม่นยำ)' : '';
    const mockWarn = dto.isMock ? ' ⚠️ ตรวจพบสัญญาณ Fake GPS' : '';
    return { ...checkin, message: `Check-in สำเร็จ (ห่าง ${dist} เมตร)${warn}${mockWarn}` };
  }

  // ---- Check-out (คำนวณระยะเวลาหน้างาน) ----
  async checkout(user: RequestUser, checkinId: string) {
    const emp = await this.requireEmployee(user.id);
    const checkin = await this.prisma.visitCheckin.findUnique({ where: { id: checkinId } });
    if (!checkin) throw new NotFoundException('ไม่พบการ check-in');
    if (checkin.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
    if (checkin.checkOutAt) throw new BadRequestException('เช็กเอาต์ไปแล้ว');
    const now = new Date();
    const minutes = Math.max(1, Math.round((now.getTime() - checkin.checkinAt.getTime()) / 60000));
    return this.prisma.visitCheckin.update({
      where: { id: checkinId },
      data: { checkOutAt: now, durationMinutes: minutes },
    });
  }

  async getPlanById(id: string) {
    return this.prisma.visitPlan.findUnique({ where: { id }, select: { id: true, agencyId: true, employeeId: true } });
  }

  // ---- Smart Replacement — หาร้านทดแทนใกล้เคียงเมื่อ reschedule ─────────
  async getSuggestions(user: RequestUser, planId: string, limit = 10) {
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id: planId },
      include: {
        agency: { select: { id: true, latitude: true, longitude: true } },
      },
    });
    if (!plan) throw new NotFoundException('ไม่พบแผน');

    const refLat = plan.agency.latitude;
    const refLng = plan.agency.longitude;

    // หา agencies ที่ employee นี้ดูแลอยู่ (isActive)
    const assigned = await this.prisma.agencyAssignment.findMany({
      where: { employeeId: plan.employeeId, isActive: true },
      select: { agencyId: true },
    });
    const assignedIds = assigned.map((a) => a.agencyId).filter((id) => id !== plan.agencyId);

    // หา agency ที่ยังไม่มีแผนวันนั้น (หรือ cancelled/rescheduled)
    const planDate = plan.planDate;
    const existingPlans = await this.prisma.visitPlan.findMany({
      where: {
        employeeId: plan.employeeId,
        planDate,
        status: { notIn: ['cancelled', 'rescheduled', 'postponed'] },
        agencyId: { in: assignedIds },
      },
      select: { agencyId: true },
    });
    const busyIds = new Set(existingPlans.map((p) => p.agencyId));
    const candidateIds = assignedIds.filter((id) => !busyIds.has(id));

    if (!candidateIds.length) return { suggestions: [] };

    const candidates = await this.prisma.agency.findMany({
      where: {
        id: { in: candidateIds },
        status: 'active',
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true, code: true, name: true, zone: true, tier: true,
        latitude: true, longitude: true, phone: true,
        assignments: { where: { isActive: true }, select: { employee: { select: { name: true } } } },
      },
    });

    // คำนวณระยะทาง แล้ว sort
    const withDist = candidates
      .map((a) => ({
        ...a,
        distanceMeters:
          refLat != null && refLng != null && a.latitude != null && a.longitude != null
            ? Math.round(distanceMeters(refLat, refLng, a.latitude!, a.longitude!))
            : null,
      }))
      .sort((a, b) => {
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      })
      .slice(0, limit);

    return { suggestions: withDist, planDate: planDate.toISOString().slice(0, 10) };
  }

  // ---- Call Confirm — โทรยืนยันนัดหมายวันก่อนเยี่ยม ─────────────────────
  async callConfirm(user: RequestUser, planId: string, dto: import('./dto/visit.dto').CallConfirmDto) {
    const plan = await this.getPlan(user, planId);
    if (plan.status === 'done') throw new BadRequestException('เข้าเยี่ยมไปแล้ว');
    if (plan.status === 'cancelled') throw new BadRequestException('แผนนี้ถูกยกเลิกแล้ว');

    let newStatus: string = plan.status;
    let rescheduledPlanId: string | null = null;

    if (dto.result === 'confirmed') {
      newStatus = 'confirmed';
    } else if (dto.result === 'rescheduled') {
      newStatus = 'rescheduled';
      // สร้างแผนใหม่สำหรับวันที่เลื่อนไป
      if (dto.rescheduledTo) {
        const newPlan = await this.prisma.visitPlan.create({
          data: {
            agencyId: plan.agencyId,
            employeeId: plan.employeeId,
            planDate: new Date(dto.rescheduledTo),
            status: 'pending',
            note: `เลื่อนจาก ${plan.planDate.toISOString().slice(0, 10)}`,
          },
        });
        rescheduledPlanId = newPlan.id;
      }
    } else if (dto.result === 'cancelled') {
      newStatus = 'cancelled';
    }
    // no_answer: status stays the same

    const updated = await this.prisma.visitPlan.update({
      where: { id: planId },
      data: {
        status: newStatus as any,
        callConfirmAt: new Date(),
        callConfirmResult: dto.result,
        callNote: dto.note,
        rescheduledTo: dto.rescheduledTo ? new Date(dto.rescheduledTo) : undefined,
      },
    });

    return { updated, rescheduledPlanId };
  }

  // ---- Contact (ผู้เข้าพบ) — อัปเดตหลัง check-in ได้ ----
  async setContact(
    user: RequestUser,
    checkinId: string,
    dto: { contactName?: string; contactPosition?: string; contactPhone?: string },
  ) {
    const emp = await this.requireEmployee(user.id);
    const checkin = await this.prisma.visitCheckin.findUnique({ where: { id: checkinId } });
    if (!checkin) throw new NotFoundException('ไม่พบการ check-in');
    if (checkin.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
    return this.prisma.visitCheckin.update({ where: { id: checkinId }, data: dto });
  }

  // ---- Follow-up tasks ----
  async createFollowUp(user: RequestUser, planId: string, dto: import('./dto/visit.dto').FollowUpDto) {
    const plan = await this.getPlan(user, planId);
    const emp = await this.prisma.employee.findUnique({ where: { userId: user.id } });
    return this.prisma.followUpTask.create({
      data: {
        agencyId: plan.agencyId,
        visitPlanId: plan.id,
        assigneeId: dto.assigneeId ?? plan.employeeId,
        createdById: emp?.id,
        title: dto.title,
        detail: dto.detail,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async listFollowUps(planId: string) {
    return this.prisma.followUpTask.findMany({
      where: { visitPlanId: planId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleFollowUp(user: RequestUser, taskId: string) {
    await this.requireEmployee(user.id);
    const t = await this.prisma.followUpTask.findUnique({ where: { id: taskId } });
    if (!t) throw new NotFoundException('ไม่พบงานติดตาม');
    const done = t.status !== 'done';
    return this.prisma.followUpTask.update({
      where: { id: taskId },
      data: { status: done ? 'done' : 'open', doneAt: done ? new Date() : null },
    });
  }

  // ---- Photo ----
  async addPhoto(
    user: RequestUser,
    checkinId: string,
    file: UploadFile,
    phase: PhotoPhase,
    coords: { latitude?: number; longitude?: number },
  ) {
    const emp = await this.requireEmployee(user.id);
    const checkin = await this.prisma.visitCheckin.findUnique({ where: { id: checkinId } });
    if (!checkin) throw new NotFoundException('ไม่พบการ check-in');
    if (checkin.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');

    // อัปโหลดขึ้น GCS (หรือ local ตอน dev) แล้วเก็บ url
    const url = await this.storage.save(file);

    return this.prisma.visitPhoto.create({
      data: {
        checkinId,
        url,
        phase,
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    });
  }

  // ---- Report ----
  async submitReport(user: RequestUser, planId: string, dto: ReportDto) {
    const plan = await this.getPlan(user, planId);
    const data = {
      purposes: dto.purposes,
      visitType: dto.visitType,
      summary: dto.summary,
      problems: dto.problems,
      actionPlan: dto.actionPlan,
      interestLevel: dto.interestLevel,
      newLeads: dto.newLeads,
      nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
    };
    return this.prisma.visitReport.upsert({
      where: { visitPlanId: plan.id },
      create: { visitPlanId: plan.id, ...data },
      update: data,
    });
  }

  // ---- Site Visit Report Dashboard ----
  async reportDashboard(user: RequestUser, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const planDate = new Date(targetDate.toISOString().slice(0, 10));

    const roleFilter = await this.buildRoleFilter(user);

    const plans = await this.prisma.visitPlan.findMany({
      where: { planDate, ...roleFilter },
      include: {
        checkin: { select: { withinRadius: true, photos: { select: { id: true } } } },
      },
    });

    const ACTIVE = ['pending', 'waiting_confirmation', 'confirmed', 'on_route'];
    return {
      scheduled: plans.length,
      completed: plans.filter((p) => p.status === 'done').length,
      confirmed: plans.filter((p) => p.status === 'confirmed').length,
      overdue: plans.filter((p) => ACTIVE.includes(p.status) && p.status !== 'confirmed').length,
      cancelled: plans.filter((p) => p.status === 'cancelled').length,
      checkinSuccess: plans.filter((p) => p.checkin?.withinRadius).length,
      photosUploaded: plans.reduce((s, p) => s + (p.checkin?.photos.length ?? 0), 0),
    };
  }

  // ---- Site Visit Report List ----
  async getReportList(
    user: RequestUser,
    params: {
      from?: string; to?: string; date?: string;
      employeeId?: string; agencyId?: string; status?: string;
      province?: string; agencyLevel?: string; agencyType?: string;
      closerId?: string;
    },
  ) {
    const roleFilter = await this.buildRoleFilter(user);
    const where: Prisma.VisitPlanWhereInput = { ...roleFilter };

    if (params.date) {
      where.planDate = new Date(params.date);
    } else {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (params.from) dateFilter.gte = new Date(params.from);
      if (params.to) dateFilter.lte = new Date(params.to);
      if (Object.keys(dateFilter).length) where.planDate = dateFilter;
    }

    if (params.employeeId) where.employeeId = params.employeeId;
    if (params.agencyId) where.agencyId = params.agencyId;
    if (params.status) where.status = params.status as any;
    if (params.province || params.agencyLevel || params.agencyType) {
      where.agency = {};
      if (params.province) where.agency = { ...where.agency, province: params.province } as any;
      if (params.agencyLevel) where.agency = { ...where.agency, level: params.agencyLevel } as any;
      if (params.agencyType) where.agency = { ...where.agency, type: params.agencyType } as any;
    }

    // Filter by closer's team: find all sales employees in the same team as the closer
    if (params.closerId) {
      const closer = await this.prisma.employee.findUnique({
        where: { id: params.closerId },
        select: { teamId: true },
      });
      if (closer?.teamId) {
        const teamMembers = await this.prisma.employee.findMany({
          where: { teamId: closer.teamId, position: 'sales' },
          select: { id: true },
        });
        const memberIds = teamMembers.map((m) => m.id);
        // Intersect with any existing employeeId filter
        if (params.employeeId) {
          where.employeeId = memberIds.includes(params.employeeId) ? params.employeeId : '__no_match__';
        } else {
          where.employeeId = { in: memberIds };
        }
      }
    }

    const plans = await this.prisma.visitPlan.findMany({
      where,
      orderBy: [{ planDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        agency: { select: { id: true, code: true, name: true, zone: true, province: true, level: true, type: true } },
        employee: { select: { id: true, code: true, name: true, teamId: true } },
        checkin: {
          select: {
            id: true, checkinAt: true, checkOutAt: true, durationMinutes: true,
            withinRadius: true, distanceMeters: true, latitude: true, longitude: true,
            contactName: true, contactPosition: true, contactPhone: true,
            photos: { select: { id: true, url: true, phase: true, takenAt: true } },
          },
        },
        report: true,
        workPhotos: { select: { id: true, url: true, caption: true, takenAt: true } },
        tasks: { where: { status: { not: 'done' } }, select: { id: true, title: true, dueDate: true } },
        posmTransactions: {
          select: {
            id: true, quantity: true,
            posmItem: { select: { name: true, unit: true } },
          },
        },
      },
    });

    // Gather unique teamIds from plans to look up closers
    const teamIds = [...new Set(plans.map((p) => (p.employee as any).teamId).filter(Boolean))];
    let closersByTeam: Map<string, { id: string; name: string; code: string }> = new Map();
    if (teamIds.length > 0) {
      const closers = await this.prisma.employee.findMany({
        where: { teamId: { in: teamIds }, position: 'closer' },
        select: { id: true, code: true, name: true, teamId: true },
      });
      for (const c of closers) {
        if (c.teamId) closersByTeam.set(c.teamId, { id: c.id, name: c.name, code: c.code });
      }
    }

    return plans.map((plan) => {
      const teamId = (plan.employee as any).teamId as string | null;
      const closer = teamId ? (closersByTeam.get(teamId) ?? null) : null;
      const posmItems = (plan.posmTransactions as any[]).map((tx) => ({
        name: tx.posmItem.name,
        quantity: tx.quantity,
        unit: tx.posmItem.unit,
      }));
      const { posmTransactions, ...rest } = plan as any;
      return { ...rest, closer, posmItems };
    });
  }

  // ---- AI Insight ----
  async getAiInsight(user: RequestUser, planId: string) {
    const plan = await this.getPlan(user, planId);
    const agencyId = plan.agencyId;

    // ประวัติการเยี่ยมทั้งหมดของ Agency นี้
    const history = await this.prisma.visitPlan.findMany({
      where: { agencyId, status: 'done' },
      orderBy: { planDate: 'desc' },
      take: 20,
      include: { report: { select: { newLeads: true, interestLevel: true } } },
    });

    const daysSinceLast = history.length > 0
      ? Math.floor((Date.now() - new Date(history[0].planDate).getTime()) / 86400000)
      : 999;

    const totalLeads = history.reduce((s, h) => s + (h.report?.newLeads ?? 0), 0);

    // visits in last 3 months
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentVisits = history.filter((h) => new Date(h.planDate) >= threeMonthsAgo).length;

    // ความสนใจล่าสุด
    const latestInterest = history[0]?.report?.interestLevel ?? null;

    // Relationship score (0-100)
    const freqScore = Math.min(30, recentVisits * 5);
    const leadScore = Math.min(20, totalLeads * 2);
    const recencyScore = Math.max(0, 50 - Math.floor(daysSinceLast / 3));
    const relationshipScore = freqScore + leadScore + recencyScore;

    const riskLevel =
      relationshipScore >= 70 ? 'low'
      : relationshipScore >= 45 ? 'medium'
      : 'high';

    const suggestRevisitDays =
      daysSinceLast > 30 ? 7
      : daysSinceLast > 14 ? 14
      : 30;

    return {
      daysSinceLast,
      totalVisits: history.length,
      recentVisits,
      totalLeads,
      latestInterest,
      relationshipScore,
      riskLevel,
      suggestRevisitDays,
    };
  }

  private async buildRoleFilter(user: RequestUser): Promise<Prisma.VisitPlanWhereInput> {
    if (user.activeRole === 'sales') {
      const emp = await this.requireEmployee(user.id);
      return { employeeId: emp.id };
    }
    return {};
  }
}
