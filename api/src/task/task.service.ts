import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async callerEmployee(userId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) throw new ForbiddenException('ไม่พบข้อมูลพนักงาน');
    return emp;
  }

  async create(user: RequestUser, dto: CreateTaskDto) {
    const callerEmp = await this.callerEmployee(user.id);
    const assignedToId = dto.assignedToId ?? callerEmp.id;

    // closer/sales can only assign to self or their team members
    if (user.role === 'sales' && assignedToId !== callerEmp.id) {
      throw new ForbiddenException('เซลส์สร้างงานให้ตัวเองเท่านั้น');
    }

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        priority: dto.priority ?? 'medium',
        type: dto.type ?? 'manual',
        assignedToId,
        agencyId: dto.agencyId,
        visitPlanId: dto.visitPlanId,
        createdById: callerEmp.id,
      },
      include: { assignedTo: { select: { id: true, name: true } }, agency: { select: { id: true, name: true } } },
    });
  }

  async list(user: RequestUser, params: { status?: string; assignedToId?: string; agencyId?: string }) {
    const where: Prisma.TaskWhereInput = {};

    if (user.role === 'sales') {
      const emp = await this.callerEmployee(user.id);
      where.assignedToId = emp.id;
    } else if (user.role === 'closer') {
      // Closer sees own team
      const emp = await this.callerEmployee(user.id);
      if (emp.teamId) {
        where.assignedTo = { teamId: emp.teamId };
      } else {
        where.assignedToId = emp.id;
      }
    }
    // admin sees all

    if (params.status) where.status = params.status as any;
    if (params.assignedToId && user.role === 'admin') where.assignedToId = params.assignedToId;
    if (params.agencyId) where.agencyId = params.agencyId;

    return this.prisma.task.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: { id: true, name: true, code: true } },
        agency: { select: { id: true, name: true } },
        visitPlan: { select: { id: true, planDate: true } },
      },
    });
  }

  async update(user: RequestUser, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('ไม่พบงาน');
    if (user.role === 'sales') {
      const emp = await this.callerEmployee(user.id);
      if (task.assignedToId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
    }
    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'done') data.doneAt = new Date();
    }
    if (dto.assignedToId !== undefined && user.role !== 'sales') data.assignedTo = { connect: { id: dto.assignedToId } };
    return this.prisma.task.update({ where: { id }, data });
  }

  async delete(user: RequestUser, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('ไม่พบงาน');
    if (user.role === 'sales') {
      const emp = await this.callerEmployee(user.id);
      if (task.assignedToId !== emp.id) throw new ForbiddenException('ไม่ใช่งานของคุณ');
      if (task.type !== 'manual') throw new ForbiddenException('ลบได้เฉพาะ Manual Task');
    }
    return this.prisma.task.delete({ where: { id } });
  }

  // Dashboard summary by role
  async summary(user: RequestUser) {
    let where: Prisma.TaskWhereInput = {};
    if (user.role === 'sales') {
      const emp = await this.callerEmployee(user.id);
      where = { assignedToId: emp.id };
    } else if (user.role === 'closer') {
      const emp = await this.callerEmployee(user.id);
      where = emp.teamId ? { assignedTo: { teamId: emp.teamId } } : { assignedToId: emp.id };
    }

    const [pending, inProgress, done, overdue] = await Promise.all([
      this.prisma.task.count({ where: { ...where, status: 'pending' } }),
      this.prisma.task.count({ where: { ...where, status: 'in_progress' } }),
      this.prisma.task.count({ where: { ...where, status: 'done' } }),
      this.prisma.task.count({ where: { ...where, status: 'overdue' } }),
    ]);
    return { pending, inProgress, done, overdue, total: pending + inProgress + done + overdue };
  }

  // Auto-create follow-up task after visit checkout
  async autoCreateAfterVisit(visitPlanId: string, employeeId: string, agencyId: string) {
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    await this.prisma.task.create({
      data: {
        title: 'ติดตามผลการขาย',
        description: 'ติดตามผลหลังเข้าเยี่ยม ภายใน 3 วัน',
        dueDate: threeDaysLater,
        priority: 'medium',
        type: 'auto' as TaskType,
        status: 'pending',
        assignedToId: employeeId,
        agencyId,
        visitPlanId,
      },
    });
  }

  // AI task: agency not visited in 45+ days
  async createAiTasksForStaleAgencies() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 45);

    const staleAgencies = await this.prisma.agency.findMany({
      where: {
        status: 'active',
        OR: [
          { lastVisitAt: { lt: cutoff } },
          { lastVisitAt: null },
        ],
        assignments: { some: { isActive: true } },
      },
      include: {
        assignments: { where: { isActive: true }, select: { employeeId: true } },
        visitPlans: {
          where: { status: 'done', planDate: { gte: cutoff } },
          select: { id: true },
          take: 1,
        },
      },
      take: 50,
    });

    let created = 0;
    for (const ag of staleAgencies) {
      if (ag.visitPlans.length > 0) continue; // visited recently via plan
      for (const asgn of ag.assignments) {
        const exists = await this.prisma.task.findFirst({
          where: {
            agencyId: ag.id,
            assignedToId: asgn.employeeId,
            type: 'ai',
            status: { in: ['pending', 'in_progress'] },
          },
        });
        if (exists) continue;
        await this.prisma.task.create({
          data: {
            title: `⚠️ เร่งด่วน: นัดเยี่ยม ${ag.name}`,
            description: `Agency นี้ไม่ได้ถูกเข้าเยี่ยมมากกว่า 45 วัน แนะนำให้เข้าเยี่ยมภายในสัปดาห์นี้`,
            dueDate: (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })(),
            priority: 'high',
            type: 'ai',
            assignedToId: asgn.employeeId,
            agencyId: ag.id,
          },
        });
        created++;
      }
    }
    return { created };
  }

  // Cron: mark overdue tasks (every night 00:05)
  @Cron('5 0 * * *', { timeZone: 'Asia/Bangkok' })
  async markOverdueCron() {
    if (this.config.get('NOTIFY_ENABLED') !== 'true') return;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await this.prisma.task.updateMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lt: today },
      },
      data: { status: 'overdue' },
    });
  }

  // Cron: weekly AI task generation (every Monday 07:00)
  @Cron('0 7 * * 1', { timeZone: 'Asia/Bangkok' })
  async aiTaskCron() {
    if (this.config.get('AI_TASK_ENABLED') !== 'true') return;
    await this.createAiTasksForStaleAgencies();
  }
}
