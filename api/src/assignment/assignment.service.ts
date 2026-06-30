import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAssignmentEngine } from './agency-assignment.engine';

@Injectable()
export class AssignmentService {
  constructor(
    private prisma: PrismaService,
    private agencyEngine: AgencyAssignmentEngine,
  ) {}

  // มอบหมาย agency ให้ employee (upsert: ถ้าเคยมีแล้ว set active)
  async assign(agencyId: string, employeeId: string) {
    const [agency, employee] = await Promise.all([
      this.prisma.agency.findUnique({ where: { id: agencyId } }),
      this.prisma.employee.findUnique({ where: { id: employeeId } }),
    ]);
    if (!agency) throw new NotFoundException('ไม่พบ Agency');
    if (!employee) throw new NotFoundException('ไม่พบพนักงาน');

    return this.prisma.agencyAssignment.upsert({
      where: { agencyId_employeeId: { agencyId, employeeId } },
      create: { agencyId, employeeId, isActive: true },
      update: { isActive: true, assignedAt: new Date() },
    });
  }

  async unassign(agencyId: string, employeeId: string) {
    await this.prisma.agencyAssignment.updateMany({
      where: { agencyId, employeeId },
      data: { isActive: false },
    });
    return { ok: true };
  }

  // agency ที่เซลส์คนนี้ดูแล
  byEmployee(employeeId: string) {
    return this.prisma.agencyAssignment.findMany({
      where: { employeeId, isActive: true },
      include: { agency: true },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // Agency Assignment Engine Methods
  async getAgenciesByScore(employeeId: string, date: string, zone?: string) {
    return this.agencyEngine.scoreAgencies(employeeId, date, zone);
  }

  async getOptimalAssignments(employeeId: string, date: string, count: number = 3) {
    return this.agencyEngine.getOptimalAssignments(employeeId, date, count);
  }

  async getBackupAgencies(employeeId: string, date: string, zone?: string, excludeIds: string[] = []) {
    return this.agencyEngine.getBackupAgencies(employeeId, date, zone, excludeIds);
  }

  async checkConsecutiveAssignments(employeeId: string, agencyId: string, date: string) {
    return this.agencyEngine.checkConsecutiveAssignments(employeeId, agencyId, date);
  }
}
