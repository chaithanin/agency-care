import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface WorkingDayResult {
  month: string; // YYYY-MM
  totalDays: number;
  holidays: string[];
  leaveDays: string[];
  trainingDays: string[];
  workingDays: number;
  availableVisitDays: number;
  nonVisitDays: string[];
}

@Injectable()
export class WorkingDaysCalculator {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate working days for an employee in a given month
   * Excludes: company holidays, employee leave, training days
   * Also marks days for follow-up, calls, etc.
   */
  async calculateMonthWorkingDays(
    employeeId: string,
    yearMonth: string, // YYYY-MM
  ): Promise<WorkingDayResult> {
    const [year, month] = yearMonth.split('-').map(Number);

    // Get first and last day of month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();

    // Initialize arrays
    const holidays: string[] = [];
    const leaveDays: string[] = [];
    const trainingDays: string[] = [];
    const nonVisitDays: string[] = [];

    // Get all days of the month
    const allDates = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month - 1, i + 1);
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    });

    // 1. Get company holidays
    const companyHolidays = await this.prisma.companyHoliday.findMany({
      where: {
        date: {
          gte: firstDay,
          lte: lastDay,
        },
      },
    });
    companyHolidays.forEach(h => holidays.push(h.date));

    // 2. Get employee leave requests (approved)
    const employeeLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'approved',
        fromDate: {
          lte: lastDay,
        },
        toDate: {
          gte: firstDay,
        },
      },
    });
    employeeLeaves.forEach(leave => {
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      for (const dateStr of allDates) {
        const d = new Date(dateStr);
        if (d >= from && d <= to) {
          leaveDays.push(dateStr);
        }
      }
    });

    // 3. Get training/meeting days
    const trainings = await this.prisma.visitPlan.findMany({
      where: {
        employeeId,
        planDate: {
          gte: firstDay.toISOString().split('T')[0],
          lte: lastDay.toISOString().split('T')[0],
        },
        actionType: { in: ['Internal Training', 'Managment Internal Meeting', 'Sales Team Morning Meetings Points'] },
      },
    });
    trainings.forEach(t => {
      if (!trainingDays.includes(t.planDate)) {
        trainingDays.push(t.planDate);
      }
    });

    // 4. Combine non-working days
    const nonWorkingSet = new Set([...holidays, ...leaveDays]);
    const nonWorkingDates = allDates.filter(d => nonWorkingSet.has(d));

    // 5. Calculate working days (baseline 24, minus non-working days)
    const baselineWorkingDays = 24; // Standard: 24 working days per month
    const actualWorkingDays = baselineWorkingDays - nonWorkingDates.length;

    // 6. Non-visit days (training, meetings, etc.) - still count as working but not for visits
    trainingDays.forEach(d => {
      if (!nonVisitDays.includes(d)) {
        nonVisitDays.push(d);
      }
    });

    const availableVisitDays = actualWorkingDays - nonVisitDays.length;

    return {
      month: yearMonth,
      totalDays: daysInMonth,
      holidays,
      leaveDays,
      trainingDays,
      workingDays: actualWorkingDays,
      availableVisitDays,
      nonVisitDays,
    };
  }

  /**
   * Get simplified working days count
   */
  async getWorkingDaysCount(
    employeeId: string,
    yearMonth: string,
  ): Promise<number> {
    const result = await this.calculateMonthWorkingDays(employeeId, yearMonth);
    return result.workingDays;
  }

  /**
   * Check if a specific date is a non-working day
   */
  async isNonWorkingDay(
    employeeId: string,
    date: string, // YYYY-MM-DD
  ): Promise<boolean> {
    const [year, month] = date.split('-').slice(0, 2).join('-').split('-').map(Number);
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

    const result = await this.calculateMonthWorkingDays(employeeId, yearMonth);
    return result.nonVisitDays.includes(date);
  }
}
