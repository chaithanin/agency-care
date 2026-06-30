import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkingDaysCalculator } from './working-days.calculator';
import { AgencyAssignmentEngine } from './agency-assignment.engine';

@Injectable()
export class AssignmentService {
  private readonly DAILY_QUOTA = 3;
  private readonly MONTHLY_QUOTA = 72; // 24 days × 3 visits

  constructor(
    private prisma: PrismaService,
    private workingDaysCalc: WorkingDaysCalculator,
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

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Assignment Planning - Working Days + Approval Workflow
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create assignment plan (AI generates draft)
   */
  async createPlanDraft(employeeId: string, month: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const workingDaysInfo =
      await this.workingDaysCalc.calculateMonthWorkingDays(employeeId, month);

    const plan = await this.prisma.assignmentPlan.create({
      data: {
        employeeId,
        month,
        status: 'draft',
        quotaTarget: this.MONTHLY_QUOTA,
        workingDays: workingDaysInfo.workingDays,
        notes: `Draft plan for ${month}`,
      },
    });

    return { plan, workingDaysInfo };
  }

  /**
   * Get plan by ID with full details
   */
  async getPlan(planId: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
      include: {
        employee: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!plan) throw new NotFoundException('Assignment plan not found');
    return plan;
  }

  /**
   * Update plan notes (Closer review)
   */
  async updatePlan(planId: string, data: { notes?: string }) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Assignment plan not found');
    if (plan.status !== 'draft' && plan.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot edit plan with status: ${plan.status}`,
      );
    }

    return await this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { notes: data.notes || plan.notes },
    });
  }

  /**
   * Submit plan for approval (Closer → Admin)
   */
  async submitForApproval(planId: string, userId: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Assignment plan not found');
    if (plan.status !== 'draft') {
      throw new BadRequestException(
        `Cannot submit plan with status: ${plan.status}`,
      );
    }

    await this.prisma.planVersion.create({
      data: {
        planId,
        version: 1,
        status: 'submitted',
        submittedBy: userId,
        notes: 'Submitted for approval',
      },
    });

    return await this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'pending_approval' },
    });
  }

  /**
   * Approve plan (Admin only)
   */
  async approvePlan(planId: string, adminId: string, notes?: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Assignment plan not found');
    if (plan.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot approve plan with status: ${plan.status}`,
      );
    }

    if (plan.quotaTarget < this.MONTHLY_QUOTA) {
      throw new BadRequestException(
        `Quota ${plan.quotaTarget} is below minimum ${this.MONTHLY_QUOTA}`,
      );
    }

    await this.prisma.planVersion.create({
      data: {
        planId,
        version: 2,
        status: 'approved',
        submittedBy: adminId,
        notes: notes || 'Approved',
      },
    });

    return await this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: {
        status: 'approved',
        approvedBy: { connect: { id: adminId } },
      },
    });
  }

  /**
   * Publish plan (make active)
   */
  async publishPlan(planId: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) throw new NotFoundException('Assignment plan not found');
    if (plan.status !== 'approved') {
      throw new BadRequestException(
        `Cannot publish plan with status: ${plan.status}`,
      );
    }

    return await this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'published', publishedAt: new Date() },
    });
  }

  /**
   * Get quota status for month
   */
  async getQuotaStatus(employeeId: string, month: string) {
    const target = this.MONTHLY_QUOTA;
    const completed = await this.prisma.visitPlan.count({
      where: {
        employeeId,
        planDate: { startsWith: month },
        status: 'done',
      },
    });

    return {
      target,
      completed,
      remaining: Math.max(0, target - completed),
      percentComplete: Math.min(100, (completed / target) * 100),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Agency Assignment Engine Integration
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get scored and ranked agencies for assignment
   */
  async getAgenciesByScore(
    employeeId: string,
    date: string,
    zone?: string,
  ) {
    return this.agencyEngine.scoreAgencies(employeeId, date, zone);
  }

  /**
   * Get optimal 3 agencies to visit on a specific date
   */
  async getOptimalAssignments(
    employeeId: string,
    date: string,
    count: number = 3,
  ) {
    return this.agencyEngine.getOptimalAssignments(employeeId, date, count);
  }

  /**
   * Get backup agencies if primary can't go
   */
  async getBackupAgencies(
    employeeId: string,
    date: string,
    zone?: string,
    excludeIds: string[] = [],
  ) {
    return this.agencyEngine.getBackupAgencies(
      employeeId,
      date,
      zone,
      excludeIds,
    );
  }

  /**
   * Check if same agency on consecutive days
   */
  async checkConsecutiveAssignments(
    employeeId: string,
    agencyId: string,
    date: string,
  ) {
    return this.agencyEngine.checkConsecutiveAssignments(
      employeeId,
      agencyId,
      date,
    );
  }
}
