import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // ภาพรวมของวัน (default = วันนี้)
  async summary(dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const [
      totalAgencies,
      activeAgencies,
      plansToday,
      doneToday,
      employees,
      perEmployeeRaw,
    ] = await Promise.all([
      this.prisma.agency.count(),
      this.prisma.agency.count({ where: { status: 'active' } }),
      this.prisma.visitPlan.count({ where: { planDate: day } }),
      this.prisma.visitPlan.count({ where: { planDate: day, status: 'done' } }),
      this.prisma.employee.count({ where: { isActive: true } }),
      this.prisma.visitPlan.groupBy({
        by: ['employeeId', 'status'],
        where: { planDate: day },
        _count: true,
      }),
    ]);

    // รวมผลต่อเซลส์
    const byEmp = new Map<string, { planned: number; done: number }>();
    for (const row of perEmployeeRaw) {
      const e = byEmp.get(row.employeeId) ?? { planned: 0, done: 0 };
      e.planned += row._count;
      if (row.status === 'done') e.done += row._count;
      byEmp.set(row.employeeId, e);
    }
    const empInfo = await this.prisma.employee.findMany({
      where: { id: { in: [...byEmp.keys()] } },
      select: { id: true, name: true, code: true },
    });
    const perEmployee = empInfo.map((emp: { id: string; name: string; code: string }) => {
      const e = byEmp.get(emp.id)!;
      return {
        employeeId: emp.id,
        name: emp.name,
        code: emp.code,
        planned: e.planned,
        done: e.done,
        completionPct: e.planned ? Math.round((e.done / e.planned) * 100) : 0,
      };
    });

    const pending = plansToday - doneToday;
    return {
      date: day.toISOString().slice(0, 10),
      agencies: { total: totalAgencies, active: activeAgencies, inactive: totalAgencies - activeAgencies },
      visits: {
        planned: plansToday,
        done: doneToday,
        pending,
        completionPct: plansToday ? Math.round((doneToday / plansToday) * 100) : 0,
      },
      employees,
      perEmployee: perEmployee.sort((a: { done: number }, b: { done: number }) => b.done - a.done),
    };
  }
}
