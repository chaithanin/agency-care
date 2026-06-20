import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface EmpKpi {
  employeeId: string;
  name: string;
  code: string;
  planned: number;
  done: number;
  completionPct: number;
  reports: number;
  reportPct: number;
  withinRadius: number;
  accuracyPct: number; // % check-in ที่อยู่ในรัศมี
  posmGiven: number;
  salesAmount: number;
}

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  // ช่วงเริ่มต้น = เดือนปัจจุบัน
  private monthRange(from?: string, to?: string) {
    if (from && to) return { gte: new Date(from), lte: new Date(to) };
    const n = new Date();
    const gte = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
    const lte = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0));
    return { gte, lte };
  }

  async summary(from?: string, to?: string) {
    const range = this.monthRange(from, to);

    const [plans, sales, posm, employees] = await Promise.all([
      this.prisma.visitPlan.findMany({
        where: { planDate: range },
        select: {
          employeeId: true,
          status: true,
          report: { select: { id: true } },
          checkin: { select: { withinRadius: true } },
        },
      }),
      this.prisma.salesActivity.findMany({
        where: { visitPlan: { planDate: range } },
        select: { amount: true, visitPlan: { select: { employeeId: true } } },
      }),
      this.prisma.posmTransaction.findMany({
        where: { visitPlan: { planDate: range } },
        select: { quantity: true, visitPlan: { select: { employeeId: true } } },
      }),
      this.prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
      }),
    ]);

    const map = new Map<string, EmpKpi>();
    for (const e of employees) {
      map.set(e.id, {
        employeeId: e.id,
        name: e.name,
        code: e.code,
        planned: 0,
        done: 0,
        completionPct: 0,
        reports: 0,
        reportPct: 0,
        withinRadius: 0,
        accuracyPct: 0,
        posmGiven: 0,
        salesAmount: 0,
      });
    }

    for (const p of plans) {
      const k = map.get(p.employeeId);
      if (!k) continue;
      k.planned++;
      if (p.status === 'done') k.done++;
      if (p.report) k.reports++;
      if (p.checkin?.withinRadius) k.withinRadius++;
    }
    for (const s of sales) {
      const k = map.get(s.visitPlan.employeeId);
      if (k) k.salesAmount += s.amount;
    }
    for (const t of posm) {
      const k = map.get(t.visitPlan.employeeId);
      if (k) k.posmGiven += t.quantity;
    }

    const result = [...map.values()].map((k) => ({
      ...k,
      completionPct: k.planned ? Math.round((k.done / k.planned) * 100) : 0,
      reportPct: k.done ? Math.round((k.reports / k.done) * 100) : 0,
      accuracyPct: k.done ? Math.round((k.withinRadius / k.done) * 100) : 0,
    }));
    result.sort((a, b) => b.salesAmount - a.salesAmount || b.completionPct - a.completionPct);

    return {
      from: range.gte.toISOString().slice(0, 10),
      to: range.lte.toISOString().slice(0, 10),
      targets: { completionPct: 100, reportPct: 100, accuracyPct: 95 },
      rows: result,
    };
  }
}
