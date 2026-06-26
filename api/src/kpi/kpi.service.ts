import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  // Get or compute KPI for a single employee in a period
  async getEmployeeKpi(employeeId: string, period: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)  // last day of month

    // Get or create KpiTarget record
    let kpi = await this.prisma.kpiTarget.findUnique({
      where: { employeeId_period: { employeeId, period } },
      include: { employee: { select: { name: true, code: true, position: true } } },
    })

    // Calculate actuals from real data
    const taskWhere = { assignedToId: employeeId, status: 'done' as const, doneAt: { gte: startDate, lte: endDate } };
    const [visitActual, followupActual, salesActual, callCount, orientationCount, customerCount, holdingCount, followupCustomerCount] = await Promise.all([
      // Completed visits this period
      this.prisma.visitPlan.count({
        where: { employeeId, status: 'done', planDate: { gte: startDate, lte: endDate } },
      }),
      // Completed tasks this period
      this.prisma.task.count({ where: taskWhere }),
      // Sales amount this period (from SalesActivity)
      this.prisma.salesActivity.aggregate({
        where: { visitPlan: { employeeId, planDate: { gte: startDate, lte: endDate } } },
        _sum: { amount: true },
      }).then(r => r._sum.amount ?? 0),
      // Activity breakdown by tag
      this.prisma.task.count({ where: { ...taskWhere, tag: 'call' } }),
      this.prisma.task.count({ where: { ...taskWhere, tag: 'orientation' } }),
      this.prisma.task.count({ where: { ...taskWhere, tag: 'customer' } }),
      this.prisma.task.count({ where: { ...taskWhere, tag: 'followup_hold' } }),
      this.prisma.task.count({ where: { ...taskWhere, tag: 'followup' } }),
    ])

    // New agencies added this period (by this employee)
    const newAgencyActual = await this.prisma.agency.count({
      where: { addedById: employeeId,
        createdAt: { gte: startDate, lte: endDate } },
    })

    // Get monthly plan targets
    const monthlyPlan = await this.prisma.monthlyPlan.findUnique({
      where: { employeeId_year_month: { employeeId, year, month } },
    })

    // Upsert KpiTarget with actuals
    kpi = await this.prisma.kpiTarget.upsert({
      where: { employeeId_period: { employeeId, period } },
      create: {
        employeeId, period,
        visitTarget: monthlyPlan?.visitTarget ?? 24,
        newAgencyTarget: monthlyPlan?.newAgencyTarget ?? 2,
        visitActual, newAgencyActual,
        salesActual, followupActual,
        lastCalcAt: new Date(),
      },
      update: {
        visitActual, newAgencyActual,
        salesActual, followupActual,
        ...(monthlyPlan && {
          visitTarget: monthlyPlan.visitTarget,
          newAgencyTarget: monthlyPlan.newAgencyTarget,
        }),
        lastCalcAt: new Date(),
      },
      include: { employee: { select: { name: true, code: true, position: true } } },
    })

    const visitRate = kpi.visitTarget ? Math.round((visitActual / kpi.visitTarget) * 100) : 0
    const newAgRate = kpi.newAgencyTarget ? Math.round((newAgencyActual / kpi.newAgencyTarget) * 100) : 0

    return {
      ...kpi,
      visitActual, newAgencyActual, salesActual, followupActual,
      callCount, orientationCount, customerCount, holdingCount, followupCustomerCount,
      visitRate, newAgencyRate: newAgRate,
      overallRate: Math.round((visitRate + newAgRate) / 2),
    }
  }

  // Get KPI for all employees in a period (team summary)
  async getTeamKpi(period: string, teamId?: string) {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, position: 'sales', ...(teamId ? { teamId } : {}) },
      select: { id: true, name: true, code: true, teamId: true },
    })

    const results = await Promise.all(
      employees.map(e => this.getEmployeeKpi(e.id, period).catch(() => null))
    )
    return results.filter(Boolean)
  }

  // Closer KPI: team coverage + team completion rate
  async getCloserKpi(closerId: string, period: string) {
    const closer = await this.prisma.employee.findUnique({
      where: { id: closerId },
      include: { team: { include: { members: { where: { position: 'sales', isActive: true } } } } },
    })
    if (!closer?.team) return null

    const teamIds = closer.team.members.map(m => m.id)
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const [totalAssigned, completed, newAgencies] = await Promise.all([
      this.prisma.visitPlan.count({
        where: { employeeId: { in: teamIds }, planDate: { gte: startDate, lte: endDate } },
      }),
      this.prisma.visitPlan.count({
        where: { employeeId: { in: teamIds }, status: 'done', planDate: { gte: startDate, lte: endDate } },
      }),
      this.prisma.agency.count({
        where: { addedById: { in: teamIds }, createdAt: { gte: startDate, lte: endDate } },
      }),
    ])

    return {
      closerId, period, teamName: closer.team.name,
      teamSize: teamIds.length,
      totalAssigned, completed, newAgencies,
      completionRate: totalAssigned ? Math.round((completed / totalAssigned) * 100) : 0,
    }
  }

  // Agency KPI (engagement score)
  async getAgencyKpi(agencyId: string) {
    const [visits30, visits90, leads, tasks] = await Promise.all([
      this.prisma.visitPlan.count({
        where: { agencyId, status: 'done',
          planDate: { gte: new Date(Date.now() - 30 * 86400000) } },
      }),
      this.prisma.visitPlan.count({
        where: { agencyId, status: 'done',
          planDate: { gte: new Date(Date.now() - 90 * 86400000) } },
      }),
      this.prisma.visitReport.aggregate({
        where: { visitPlan: { agencyId } },
        _sum: { newLeads: true },
      }).then(r => r._sum.newLeads ?? 0),
      this.prisma.task.count({
        where: { agencyId, status: { in: ['done', 'in_progress'] } },
      }),
    ])

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId }, select: { name: true, level: true, agencyScore: true, agencyScoreNum: true },
    })

    return {
      agencyId, agencyName: agency?.name, level: agency?.level,
      visits30d: visits30, visits90d: visits90, totalLeads: leads, totalTasks: tasks,
      engagementScore: Math.min(100, visits30 * 20 + visits90 * 5 + leads * 3),
    }
  }

  // Org KPI summary
  async getOrgKpi(period: string) {
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const [totalVisits, completedVisits, totalAgencies, activeAgencies, totalSales] = await Promise.all([
      this.prisma.visitPlan.count({ where: { planDate: { gte: startDate, lte: endDate } } }),
      this.prisma.visitPlan.count({ where: { status: 'done', planDate: { gte: startDate, lte: endDate } } }),
      this.prisma.agency.count(),
      this.prisma.agency.count({ where: { status: 'active' } }),
      this.prisma.salesActivity.aggregate({
        where: { visitPlan: { planDate: { gte: startDate, lte: endDate } } },
        _sum: { amount: true },
      }).then(r => r._sum.amount ?? 0),
    ])

    return {
      period,
      totalVisits, completedVisits,
      completionRate: totalVisits ? Math.round((completedVisits / totalVisits) * 100) : 0,
      totalAgencies, activeAgencies,
      coverageRate: totalAgencies ? Math.round((activeAgencies / totalAgencies) * 100) : 0,
      totalSales,
    }
  }
}
