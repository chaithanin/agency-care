import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotoPhase, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  private get maxRadius(): number {
    return Number(this.config.get('CHECKIN_MAX_RADIUS_METERS', 200));
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

  // ---- Check-in (GPS) ----
  async checkin(user: RequestUser, planId: string, dto: CheckinDto) {
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

    const dist = distanceMeters(
      dto.latitude,
      dto.longitude,
      plan.agency.latitude,
      plan.agency.longitude,
    );
    const within = dist <= this.maxRadius;
    if (!within) {
      throw new BadRequestException(
        `อยู่ห่างจาก Agency ${dist} เมตร (เกิน ${this.maxRadius} เมตร) — ไม่อนุญาตให้ check-in`,
      );
    }

    const checkin = await this.prisma.visitCheckin.create({
      data: {
        visitPlanId: plan.id,
        employeeId: emp.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        distanceMeters: dist,
        withinRadius: within,
      },
    });
    // check-in สำเร็จ -> mark plan = done
    await this.prisma.visitPlan.update({ where: { id: plan.id }, data: { status: 'done' } });
    return { ...checkin, message: `Check-in สำเร็จ (ห่าง ${dist} เมตร)` };
  }

  // ---- Photo ----
  async addPhoto(
    user: RequestUser,
    checkinId: string,
    file: { filename: string },
    phase: PhotoPhase,
    coords: { latitude?: number; longitude?: number },
  ) {
    const emp = await this.requireEmployee(user.id);
    const checkin = await this.prisma.visitCheckin.findUnique({ where: { id: checkinId } });
    if (!checkin) throw new NotFoundException('ไม่พบการ check-in');
    if (checkin.employeeId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');

    return this.prisma.visitPhoto.create({
      data: {
        checkinId,
        url: `/uploads/${file.filename}`,
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
