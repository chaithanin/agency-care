import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateLeaveDto {
  leaveType: string;
  startDate: string; // ISO date
  endDate: string;
  days: number;
  reason?: string;
}

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  private calcDays(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  }

  async create(employeeId: string, dto: CreateLeaveDto) {
    const days = dto.days || this.calcDays(dto.startDate, dto.endDate);
    return this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveType: dto.leaveType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        days,
        reason: dto.reason,
        status: 'pending',
      },
      include: { employee: { select: { id: true, name: true, code: true } } },
    });
  }

  async list(filters: { employeeId?: string; status?: string; month?: string }) {
    const where: any = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.month) {
      const [year, mon] = filters.month.split('-').map(Number);
      where.startDate = {
        gte: new Date(year, mon - 1, 1),
        lt: new Date(year, mon, 1),
      };
    }
    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, code: true, position: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, approvedById: string) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'pending') throw new ForbiddenException('Only pending requests can be approved');
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'approved', approvedById, approvedAt: new Date() },
      include: { employee: { select: { id: true, name: true, code: true } } },
    });
  }

  async reject(id: string, approvedById: string, reason?: string) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== 'pending') throw new ForbiddenException('Only pending requests can be rejected');
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'rejected', approvedById, approvedAt: new Date(), rejectedReason: reason },
      include: { employee: { select: { id: true, name: true, code: true } } },
    });
  }

  async cancel(id: string, employeeId: string) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.employeeId !== employeeId) throw new ForbiddenException('Cannot cancel others\' requests');
    if (req.status === 'approved') throw new ForbiddenException('Cannot cancel approved requests');
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
  }

  async summary(month: string) {
    const [year, mon] = month.split('-').map(Number);
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        startDate: { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) },
      },
      include: { employee: { select: { id: true, name: true, code: true } } },
    });
    return rows;
  }
}
