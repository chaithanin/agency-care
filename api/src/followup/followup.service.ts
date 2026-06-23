import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';

@Injectable()
export class FollowupService {
  constructor(private prisma: PrismaService) {}

  async list(user: RequestUser) {
    // Admin/closer see all; sales see only their own
    const where: any = {};
    if (user.activeRole === 'sales') {
      const emp = await this.prisma.employee.findUnique({ where: { userId: user.id } });
      if (emp) where.assigneeId = emp.id;
    }

    const rows = await this.prisma.followUpTask.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    // Enrich with agency name and assignee name
    const agencyIds = [...new Set(rows.map(r => r.agencyId).filter(Boolean))] as string[];
    const assigneeIds = [...new Set(rows.map(r => r.assigneeId).filter(Boolean))] as string[];

    const [agencies, employees] = await Promise.all([
      agencyIds.length
        ? this.prisma.agency.findMany({ where: { id: { in: agencyIds } }, select: { id: true, name: true } })
        : [],
      assigneeIds.length
        ? this.prisma.employee.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const agencyMap = Object.fromEntries(agencies.map(a => [a.id, a.name]));
    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

    return rows.map(r => ({
      ...r,
      agencyName: agencyMap[r.agencyId] ?? null,
      assigneeName: r.assigneeId ? (empMap[r.assigneeId] ?? null) : null,
    }));
  }

  async markDone(user: RequestUser, id: string) {
    const item = await this.prisma.followUpTask.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบ follow-up task');
    return this.prisma.followUpTask.update({
      where: { id },
      data: { status: 'done', doneAt: new Date() },
    });
  }
}
