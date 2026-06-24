import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgencyScoreService {
  constructor(private prisma: PrismaService) {}

  // Calculate 0-100 score for a single agency
  async calcScore(agencyId: string): Promise<number> {
    const [agency, visits30, visits90, leadsSum, hasFollowup] = await Promise.all([
      this.prisma.agency.findUnique({
        where: { id: agencyId },
        select: {
          level: true,
          totalUnitsSold: true,
          advertisesOurProjects: true,
          paidAds: true,
          numSalesAgents: true,
          sellsOurProjects: true,
          agreementActive: true,
          lastSaleDate: true,
        },
      }),
      this.prisma.visitPlan.count({
        where: {
          agencyId,
          status: 'done',
          planDate: { gte: new Date(Date.now() - 30 * 86400000) },
        },
      }),
      this.prisma.visitPlan.count({
        where: {
          agencyId,
          status: 'done',
          planDate: { gte: new Date(Date.now() - 90 * 86400000) },
        },
      }),
      this.prisma.visitReport
        .aggregate({
          where: { visitPlan: { agencyId } },
          _sum: { newLeads: true },
        })
        .then((r) => r._sum.newLeads ?? 0),
      this.prisma.followUpTask.count({
        where: {
          agencyId,
          status: 'done',
          doneAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
      }),
    ]);

    if (!agency) return 0;

    // Scoring factors (total = 100):
    // 1. Sales performance (30 pts)
    const units = agency.totalUnitsSold ?? 0;
    const salesScore =
      units >= 50 ? 30 : units >= 20 ? 22 : units >= 10 ? 15 : units >= 1 ? 8 : 0;

    // 2. Visit frequency (25 pts)
    const visitScore =
      visits30 >= 4 ? 25 : visits30 >= 2 ? 18 : visits30 >= 1 ? 12 : visits90 >= 1 ? 6 : 0;

    // 3. Lead generation (20 pts)
    const leadScore =
      leadsSum >= 10 ? 20 : leadsSum >= 5 ? 14 : leadsSum >= 2 ? 8 : leadsSum >= 1 ? 4 : 0;

    // 4. Advertising & Marketing (15 pts)
    const adsScore = (agency.advertisesOurProjects ? 8 : 0) + (agency.paidAds ? 7 : 0);

    // 5. Sales agents & engagement (10 pts)
    const agents = agency.numSalesAgents ?? 0;
    const agentScore =
      agents >= 10 ? 10 : agents >= 5 ? 7 : agents >= 2 ? 4 : agents >= 1 ? 2 : 0;

    const total = salesScore + visitScore + leadScore + adsScore + agentScore;

    // Derive letter grade
    const letter = total >= 80 ? 'VIP' : total >= 65 ? 'A' : total >= 45 ? 'B' : 'C';

    // Store back to database
    await this.prisma.agency.update({
      where: { id: agencyId },
      data: { agencyScoreNum: total, agencyScore: letter },
    });

    return total;
  }

  // Recalculate scores for all active agencies (called by cron)
  async recalcAll(): Promise<{ updated: number }> {
    const agencies = await this.prisma.agency.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
    let updated = 0;
    for (const a of agencies) {
      try {
        await this.calcScore(a.id);
        updated++;
      } catch {}
    }
    return { updated };
  }
}
