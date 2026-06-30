import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentPlannerService {
  constructor(private prisma: PrismaService) {}

  // DRAFT STAGE
  async createDraft(period: string, createdById: string) {
    const existing = await this.prisma.assignmentPlan.findFirst({
      where: { period, createdById, status: 'draft' },
    });
    if (existing) throw new BadRequestException('Draft already exists for this period');

    return this.prisma.assignmentPlan.create({
      data: {
        period,
        status: 'draft',
        createdById,
        title: `Plan ${period}`,
      },
    });
  }

  async editDraft(planId: string, changes: any) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'draft') throw new BadRequestException('Can only edit draft plans');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: changes,
    });
  }

  // REVIEW STAGE
  async submitForReview(planId: string, submittedBy: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'draft') throw new BadRequestException('Only draft plans can be submitted');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'draft', note: 'submitted' },
    });
  }

  async reviewDraft(planId: string, approved: boolean, note?: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: approved ? 'approved' : 'draft', note },
    });
  }

  // APPROVAL STAGE
  async approvePlan(planId: string, approvedBy: string, note?: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'pending_review') throw new BadRequestException('Plan must be in review stage');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'approved', approvedById: approvedBy, approvedAt: new Date(), note },
    });
  }

  async rejectPlan(planId: string, approvedBy: string, reason: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'draft', note: `Rejected: ${reason}` },
    });
  }

  async publishPlan(planId: string, publishedBy: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'approved') throw new BadRequestException('Plan must be approved first');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  // VERSIONING
  async getPlanVersions(planId: string) {
    return this.prisma.planVersion.findMany({
      where: { planId },
      orderBy: { versionNo: 'desc' },
    });
  }

  async rollbackToVersion(planId: string, versionNo: number) {
    const version = await this.prisma.planVersion.findFirst({
      where: { planId, versionNo },
    });
    if (!version) throw new NotFoundException('Version not found');

    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'draft' },
    });
  }

  async createVersion(planId: string, reason: string, changedBy: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const lastVersion = await this.prisma.planVersion.findFirst({
      where: { planId },
      orderBy: { versionNo: 'desc' },
    });

    const versionNo = (lastVersion?.versionNo || 0) + 1;

    return this.prisma.planVersion.create({
      data: {
        planId,
        versionNo,
        note: reason,
        createdById: changedBy,
      },
    });
  }

  // STATISTICS
  async getPlanStats(planId: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
      include: { versions: true },
    });

    if (!plan) throw new NotFoundException('Plan not found');

    const [year, month] = plan.period.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    const workingDays = 24; // Baseline
    const targetVisits = workingDays * 3;

    return {
      planId,
      period: plan.period,
      totalAgencies: plan.totalAgencies,
      totalSales: plan.totalSales,
      workingDays,
      targetVisits,
      versions: plan.versions.length,
    };
  }

  async getMonthlyStats(employeeId: string, month: string) {
    const [year, monthNum] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);

    const workingDays = 24;
    const targetVisits = 72;

    const completedVisits = await this.prisma.visitPlan.count({
      where: {
        employeeId,
        planDate: { gte: firstDay, lte: lastDay },
        status: 'done',
      },
    });

    return {
      employeeId,
      month,
      workingDays,
      targetVisits,
      completedVisits,
      remaining: Math.max(0, targetVisits - completedVisits),
      rate: ((completedVisits / targetVisits) * 100).toFixed(1),
    };
  }
}
