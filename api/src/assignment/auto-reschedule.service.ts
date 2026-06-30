import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAssignmentEngine } from './agency-assignment.engine';

export interface RescheduleResult {
  originalPlanId: string;
  reason: 'cancelled' | 'rescheduled' | 'employee_leave' | 'force_majeure';
  backupAgency?: {
    id: string;
    code: string;
    name: string;
    score: number;
  };
  newPlanId?: string;
  status: 'reassigned' | 'pending_manual' | 'no_backup_available';
  message: string;
}

@Injectable()
export class AutoRescheduleService {
  constructor(
    private prisma: PrismaService,
    private agencyEngine: AgencyAssignmentEngine,
  ) {}

  /**
   * Handle agency cancellation - find and assign backup agency
   */
  async handleAgencyCancellation(planId: string): Promise<RescheduleResult> {
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id: planId },
      include: { agency: true, employee: true },
    });

    if (!plan) throw new NotFoundException('Visit plan not found');
    if (plan.status === 'cancelled') {
      throw new BadRequestException('Plan already cancelled');
    }

    // Mark original as cancelled
    await this.prisma.visitPlan.update({
      where: { id: planId },
      data: { status: 'cancelled' },
    });

    // Convert planDate to string
    const originalDateStr = plan.planDate instanceof Date ? plan.planDate.toISOString().split('T')[0] : plan.planDate;

    // Get backup agencies
    const backupAgencies = await this.agencyEngine.getBackupAgencies(
      plan.employeeId,
      originalDateStr,
      plan.agency?.zone || undefined,
      [plan.agencyId],
    );

    if (backupAgencies.length === 0) {
      return {
        originalPlanId: planId,
        reason: 'cancelled',
        status: 'pending_manual',
        message: `No backup agencies available for ${plan.agency?.name} on ${originalDateStr}. Notify Closer for manual assignment.`,
      };
    }

    // Create new plan with backup agency
    const topBackup = backupAgencies[0];
    const newPlan = await this.prisma.visitPlan.create({
      data: {
        employeeId: plan.employeeId,
        agencyId: topBackup.id,
        planDate: originalDateStr as any,
        actionType: plan.actionType,
        status: 'pending',
        note: `Auto-reassigned from ${plan.agency?.name} (cancelled)`,
      },
    });

    return {
      originalPlanId: planId,
      reason: 'cancelled',
      backupAgency: {
        id: topBackup.id,
        code: topBackup.code,
        name: topBackup.name,
        score: topBackup.score,
      },
      newPlanId: newPlan.id,
      status: 'reassigned',
      message: `Cancelled visit to ${plan.agency?.name}. Auto-assigned backup: ${topBackup.name} (score: ${topBackup.score})`,
    };
  }

  /**
   * Handle agency reschedule request - move to next available slot
   */
  async handleAgencyReschedule(
    planId: string,
    newDate: string,
  ): Promise<RescheduleResult> {
    const plan = await this.prisma.visitPlan.findUnique({
      where: { id: planId },
      include: { agency: true },
    });

    if (!plan) throw new NotFoundException('Visit plan not found');

    // Validate new date
    const planDateStr = typeof plan.planDate === 'string' ? plan.planDate : plan.planDate.toISOString().split('T')[0];
    if (new Date(newDate) <= new Date(planDateStr)) {
      throw new BadRequestException('New date must be after original date');
    }

    // Check if same agency already scheduled on new date
    const existing = await this.prisma.visitPlan.findFirst({
      where: {
        employeeId: plan.employeeId,
        agencyId: plan.agencyId,
        planDate: newDate,
        status: { not: 'cancelled' },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Agency already scheduled on ${newDate}`,
      );
    }

    // Create new plan for rescheduled date
    const newPlan = await this.prisma.visitPlan.create({
      data: {
        employeeId: plan.employeeId,
        agencyId: plan.agencyId,
        planDate: newDate as any,
        actionType: plan.actionType,
        status: 'pending',
        note: `Rescheduled from ${planDateStr}`,
      },
    });

    // Mark original as rescheduled
    await this.prisma.visitPlan.update({
      where: { id: planId },
      data: { status: 'rescheduled' },
    });

    // Find backup for original date
    const reschedOriginalDateStr = plan.planDate instanceof Date ? plan.planDate.toISOString().split('T')[0] : plan.planDate;
    const backupAgencies = await this.agencyEngine.getBackupAgencies(
      plan.employeeId,
      reschedOriginalDateStr,
      plan.agency?.zone || undefined,
      [plan.agencyId],
    );

    let backupPlanId: string | undefined;
    if (backupAgencies.length > 0) {
      const backup = backupAgencies[0];
      const backupPlan = await this.prisma.visitPlan.create({
        data: {
          employeeId: plan.employeeId,
          agencyId: backup.id,
          planDate: plan.planDate,
          actionType: plan.actionType,
          status: 'pending',
          note: `Backup for rescheduled ${plan.agency?.name}`,
        },
      });
      backupPlanId = backupPlan.id;
    }

    return {
      originalPlanId: planId,
      reason: 'rescheduled',
      backupAgency: backupAgencies[0]
        ? {
            id: backupAgencies[0].id,
            code: backupAgencies[0].code,
            name: backupAgencies[0].name,
            score: backupAgencies[0].score,
          }
        : undefined,
      newPlanId: newPlan.id,
      status: backupPlanId ? 'reassigned' : 'pending_manual',
      message: `Rescheduled ${plan.agency?.name} to ${newDate}. ${
        backupPlanId
          ? `Auto-assigned backup for original date.`
          : 'No backup available for original date.'
      }`,
    };
  }

  /**
   * Handle employee sick leave - auto-reschedule all their visits
   */
  async handleEmployeeSickLeave(employeeId: string, date: string): Promise<RescheduleResult[]> {
    const plans = await this.prisma.visitPlan.findMany({
      where: {
        employeeId,
        planDate: date,
        status: { not: 'done' },
      },
      include: { agency: true },
    });

    const results: RescheduleResult[] = [];

    for (const plan of plans) {
      // Find next available working day (not weekend)
      let nextDate = new Date(date);
      let found = false;

      for (let i = 1; i <= 7; i++) {
        nextDate.setDate(nextDate.getDate() + 1);
        const dayOfWeek = nextDate.getDay();

        // Skip weekends (0=Sunday, 6=Saturday)
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        // Check if employee has existing plans (simple check)
        const existing = await this.prisma.visitPlan.count({
          where: {
            employeeId,
            planDate: nextDate.toISOString().split('T')[0],
          },
        });

        // Limit to 3 visits per day
        if (existing < 3) {
          found = true;
          break;
        }
      }

      if (!found) {
        results.push({
          originalPlanId: plan.id,
          reason: 'employee_leave',
          status: 'pending_manual',
          message: `Could not auto-reschedule ${plan.agency?.name}. No available slots.`,
        });
        continue;
      }

      const rescheduleResult = await this.handleAgencyReschedule(
        plan.id,
        nextDate.toISOString().split('T')[0],
      );

      results.push(rescheduleResult);
    }

    return results;
  }

  /**
   * Get all plans that need rescheduling (cancelled agencies, etc)
   */
  async getPendingReschedules() {
    return await this.prisma.visitPlan.findMany({
      where: {
        status: { in: ['rescheduled', 'postponed'] },
      },
      include: { agency: true, employee: true },
      orderBy: { planDate: 'asc' },
    });
  }

  /**
   * Get statistics on rescheduling activity
   */
  async getRescheduleStats(month: string) {
    const [year, monthNum] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);

    const [cancelled, rescheduled, forceReschedule] = await Promise.all([
      this.prisma.visitPlan.count({
        where: {
          planDate: { gte: firstDay, lte: lastDay },
          status: 'cancelled',
        },
      }),
      this.prisma.visitPlan.count({
        where: {
          planDate: { gte: firstDay, lte: lastDay },
          status: 'rescheduled',
        },
      }),
      this.prisma.visitPlan.count({
        where: {
          planDate: { gte: firstDay, lte: lastDay },
          status: 'postponed',
        },
      }),
    ]);

    return {
      month,
      cancelled,
      rescheduled,
      forceReschedule,
      total: cancelled + rescheduled + forceReschedule,
      rate: ((cancelled + rescheduled) / (cancelled + rescheduled + 100)) * 100,
    };
  }
}
