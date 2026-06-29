import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard, Roles } from '../auth/guards';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

function apptColor(apptType: string, meetingType?: string): string {
  if (apptType === 'site_visit') return '#16A34A';
  const map: Record<string, string> = {
    training: '#D97706', contract: '#DC2626',
    marketing: '#7C3AED', campaign: '#9333EA',
    follow_up: '#EA580C', complaint: '#BE123C',
  };
  return map[meetingType ?? ''] ?? '#2563EB';
}

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly db: PrismaService) {}

  private async genApptNo(): Promise<string> {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const prefix = `APT-${ymd}-`;
    const count = await this.db.appointment.count({ where: { apptNo: { startsWith: prefix } } });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  @Get('dashboard')
  async dashboard() {
    const now = new Date();
    const todayStart = new Date(now.toISOString().slice(0, 10) + 'T00:00:00+07:00');
    const todayEnd = new Date(now.toISOString().slice(0, 10) + 'T23:59:59+07:00');

    const [total, confirmed, pending, cancelled, completed, noShow, todayItems] = await Promise.all([
      this.db.appointment.count({ where: { apptDate: { gte: todayStart, lte: todayEnd } } }),
      this.db.appointment.count({ where: { apptDate: { gte: todayStart, lte: todayEnd }, status: 'confirmed' } }),
      this.db.appointment.count({ where: { apptDate: { gte: todayStart, lte: todayEnd }, status: 'pending' } }),
      this.db.appointment.count({ where: { apptDate: { gte: todayStart, lte: todayEnd }, status: 'cancelled' } }),
      this.db.appointment.count({ where: { apptDate: { gte: todayStart, lte: todayEnd }, status: 'completed' } }),
      this.db.appointment.count({ where: { apptDate: { gte: todayStart, lte: todayEnd }, status: 'no_show' } }),
      this.db.appointment.findMany({
        where: { apptDate: { gte: todayStart, lte: todayEnd } },
        orderBy: { startTime: 'asc' },
        include: {
          agency: { select: { id: true, name: true, code: true } },
          sale: { select: { id: true, name: true } },
          closer: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { total, confirmed, pending, cancelled, completed, noShow, todayItems };
  }

  @Get('calendar')
  async calendar(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    // extend to cover full days in Bangkok time
    const toDateEnd = new Date(toDate);
    toDateEnd.setHours(23, 59, 59);

    const [appts, visits] = await Promise.all([
      this.db.appointment.findMany({
        where: { apptDate: { gte: fromDate, lte: toDateEnd }, status: { not: 'cancelled' } },
        include: {
          agency: { select: { id: true, name: true } },
          sale: { select: { id: true, name: true } },
          closer: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.db.visitPlan.findMany({
        where: { planDate: { gte: fromDate, lte: toDateEnd } },
        include: {
          agency: { select: { id: true, name: true } },
          employee: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { planDate: 'asc' },
      }),
    ]);

    const toBKKDate = (dt: Date) =>
      dt.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
    const toBKKTime = (dt: Date) =>
      dt.toLocaleTimeString('sv-SE', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

    return [
      ...appts.map(a => ({
        id: a.id,
        sourceType: 'appointment',
        title: a.agency.name,
        date: toBKKDate(a.apptDate),
        startTime: toBKKTime(a.startTime),
        endTime: toBKKTime(a.endTime),
        status: a.status,
        apptType: a.apptType,
        meetingType: a.meetingType,
        agencyId: a.agencyId,
        agencyName: a.agency.name,
        saleId: a.saleId,
        saleName: a.sale?.name,
        closerId: a.closerId,
        closerName: a.closer?.name,
        color: apptColor(a.apptType, a.meetingType),
        apptNo: a.apptNo,
        meetingRoom: a.meetingRoom,
      })),
      ...visits
        .filter(v => v.status !== 'cancelled')
        .map(v => ({
          id: v.id,
          sourceType: 'site_visit',
          title: v.agency.name,
          date: toBKKDate(v.planDate),
          startTime: undefined,
          endTime: undefined,
          status: v.status,
          apptType: 'site_visit',
          meetingType: v.actionType ?? undefined,
          agencyId: v.agencyId,
          agencyName: v.agency.name,
          saleId: v.employee?.userId,
          saleName: v.employee?.user?.name,
          color: '#16A34A',
        })),
    ];
  }

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agencyId') agencyId?: string,
    @Query('saleId') saleId?: string,
    @Query('apptType') apptType?: string,
    @Query('meetingType') meetingType?: string,
    @Query('agencyCategory') agencyCategory?: string,
  ) {
    const isAdmin = ['manager', 'super_admin', 'admin'].includes(role);
    const take = Math.min(parseInt(limit) || 50, 200);
    const skip = parseInt(offset) || 0;

    const and: any[] = [];
    if (!isAdmin) {
      and.push({ OR: [{ saleId: userId }, { closerId: userId }, { createdById: userId }] });
    }
    if (status) and.push({ status });
    if (agencyId) and.push({ agencyId });
    if (saleId) and.push({ saleId });
    if (apptType) and.push({ apptType });
    if (meetingType) and.push({ meetingType });
    if (from || to) {
      and.push({
        apptDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      });
    }
    if (agencyCategory) {
      const agencyFilters: any[] = [
        { type: { contains: agencyCategory, mode: 'insensitive' } },
        { classification: { contains: agencyCategory, mode: 'insensitive' } },
        { tier: { contains: agencyCategory, mode: 'insensitive' } },
        { pipelineStage: { contains: agencyCategory, mode: 'insensitive' } },
      ];
      if (['VIP', 'A', 'B', 'C', 'D'].includes(agencyCategory.toUpperCase())) {
        agencyFilters.push({ level: agencyCategory.toUpperCase() });
      }
      and.push({
        agency: {
          OR: agencyFilters,
        },
      });
    }
    if (search) {
      and.push({
        OR: [
          { agency: { name: { contains: search, mode: 'insensitive' } } },
          { agency: { code: { contains: search, mode: 'insensitive' } } },
          { agency: { type: { contains: search, mode: 'insensitive' } } },
          { agency: { classification: { contains: search, mode: 'insensitive' } } },
          { apptNo: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { contactPhone: { contains: search, mode: 'insensitive' } },
          { meetingRoom: { contains: search, mode: 'insensitive' } },
          { purpose: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { sale: { name: { contains: search, mode: 'insensitive' } } },
          { closer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }
    const where = and.length > 0 ? { AND: and } : {};

    const [total, items] = await Promise.all([
      this.db.appointment.count({ where }),
      this.db.appointment.findMany({
        where, take, skip,
        orderBy: [{ apptDate: 'desc' }, { startTime: 'desc' }],
        include: {
          agency: { select: { id: true, name: true, code: true, type: true, classification: true, level: true, tier: true } },
          sale: { select: { id: true, name: true } },
          closer: { select: { id: true, name: true } },
          report: { select: { id: true, interestScore: true } },
        },
      }),
    ]);

    return { total, items };
  }

  @Post()
  async create(@CurrentUser('id') userId: string, @Body() dto: any) {
    const apptNo = await this.genApptNo();
    return this.db.appointment.create({
      data: {
        apptNo,
        agencyId: dto.agencyId,
        contactPerson: dto.contactPerson || null,
        contactPhone: dto.contactPhone || null,
        saleId: dto.saleId || userId,
        closerId: dto.closerId || null,
        createdById: userId,
        apptType: dto.apptType || 'showroom',
        meetingType: dto.meetingType || 'project_presentation',
        meetingRoom: dto.meetingRoom || null,
        apptDate: new Date(dto.apptDate),
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        purpose: dto.purpose || null,
        status: 'pending',
        participantIds: dto.participantIds || [],
        notes: dto.notes || null,
      },
      include: {
        agency: { select: { id: true, name: true, code: true } },
        sale: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true } },
      },
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const appt = await this.db.appointment.findUnique({
      where: { id },
      include: {
        agency: { select: { id: true, name: true, code: true, phone: true, type: true, classification: true, level: true, tier: true } },
        sale: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        report: true,
        attachments: true,
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: any,
  ) {
    const appt = await this.db.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException();
    const isAdmin = ['manager', 'super_admin', 'admin'].includes(role);
    if (!isAdmin && appt.createdById !== userId && appt.saleId !== userId) throw new ForbiddenException();

    const { apptNo: _no, createdById: _cb, ...data } = dto;
    return this.db.appointment.update({
      where: { id },
      data: {
        ...data,
        apptDate: data.apptDate ? new Date(data.apptDate) : undefined,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        saleId: data.saleId || null,
        closerId: data.closerId || null,
      },
      include: {
        agency: { select: { id: true, name: true } },
        sale: { select: { id: true, name: true } },
        closer: { select: { id: true, name: true } },
      },
    });
  }

  @Post(':id/confirm')
  @Roles('manager', 'super_admin', 'admin', 'closer')
  async confirm(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.db.appointment.update({
      where: { id },
      data: { status: 'confirmed', confirmedById: userId, confirmedAt: new Date() },
    });
  }

  @Post(':id/check-in')
  async checkIn(@Param('id') id: string, @Body() dto: any) {
    return this.db.appointment.update({
      where: { id },
      data: {
        status: 'checked_in',
        checkInAt: new Date(),
        receptionName: dto.receptionName || null,
        meetingRoomActual: dto.meetingRoomActual || null,
        notes: dto.notes || null,
      },
    });
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string) {
    return this.db.appointment.update({
      where: { id },
      data: { status: 'completed', checkOutAt: new Date() },
    });
  }

  @Post(':id/no-show')
  @Roles('manager', 'super_admin', 'admin', 'closer')
  async noShow(@Param('id') id: string, @Body() dto: any) {
    return this.db.appointment.update({
      where: { id },
      data: { status: 'no_show', notes: dto.notes || null },
    });
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: any,
  ) {
    const appt = await this.db.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException();
    const canCancel = ['manager', 'super_admin', 'admin', 'closer'].includes(role)
      || appt.createdById === userId || appt.saleId === userId;
    if (!canCancel) throw new ForbiddenException();
    return this.db.appointment.update({
      where: { id },
      data: { status: 'cancelled', cancelReason: dto.reason || null },
    });
  }

  @Post(':id/report')
  async submitReport(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: any) {
    const { appointmentId: _a, id: _id, createdById: _cb, createdAt: _ca, updatedAt: _ua, ...fields } = dto;
    const existing = await this.db.meetingReport.findUnique({ where: { appointmentId: id } });
    if (existing) {
      return this.db.meetingReport.update({ where: { appointmentId: id }, data: { ...fields, updatedAt: new Date() } });
    }
    return this.db.meetingReport.create({ data: { ...fields, appointmentId: id, createdById: userId } });
  }

  @Delete(':id')
  @Roles('manager', 'super_admin', 'admin')
  async remove(@Param('id') id: string) {
    await this.db.appointment.delete({ where: { id } });
    return { ok: true };
  }
}
