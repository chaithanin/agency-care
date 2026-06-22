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

    return this.prisma.visitPlan.create({
      data: {
        agencyId: dto.agencyId,
        employeeId: dto.employeeId,
        planDate: new Date(dto.planDate),
        note: dto.note,
      },
    });
  }

  // list ตามช่วงวัน/เซลส์ — admin เห็นหมด, sales เห็นเฉพาะตัวเอง
  async listPlans(user: RequestUser, params: { date?: string; from?: string; to?: string; employeeId?: string }) {
    const where: Prisma.VisitPlanWhereInput = {};

    if (user.role === 'sales') {
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

    return this.prisma.visitPlan.findMany({
      where,
      orderBy: [{ planDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        agency: { select: { id: true, code: true, name: true, latitude: true, longitude: true, zone: true } },
        employee: { select: { id: true, code: true, name: true } },
        checkin: { select: { id: true, checkinAt: true, withinRadius: true, distanceMeters: true } },
        report: { select: { id: true } },
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
    if (user.role === 'sales') {
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
    return this.prisma.visitReport.upsert({
      where: { visitPlanId: plan.id },
      create: {
        visitPlanId: plan.id,
        purposes: dto.purposes,
        summary: dto.summary,
        problems: dto.problems,
        actionPlan: dto.actionPlan,
      },
      update: {
        purposes: dto.purposes,
        summary: dto.summary,
        problems: dto.problems,
        actionPlan: dto.actionPlan,
      },
    });
  }
}
