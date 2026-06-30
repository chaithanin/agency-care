import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AgencyWithScore {
  id: string;
  code: string;
  name: string;
  zone?: string;
  level: string;
  tier?: string;
  daysSinceVisit: number;
  isNew: boolean;
  score: number;
}

@Injectable()
export class AgencyAssignmentEngine {
  constructor(private prisma: PrismaService) {}

  /**
   * Score and rank agencies for assignment
   * Higher score = higher priority to visit
   */
  async scoreAgencies(
    employeeId: string,
    date: string,
    zone?: string,
  ): Promise<AgencyWithScore[]> {
    // Get all active agencies assigned to this employee
    const assignments = await this.prisma.agencyAssignment.findMany({
      where: { employeeId, isActive: true },
      include: { agency: true },
    });

    // Filter by zone if provided
    let agencies = assignments.map(a => a.agency);
    if (zone) {
      agencies = agencies.filter(a => a.zone === zone);
    }

    // Score each agency
    const scored = await Promise.all(
      agencies.map(async (agency) => {
        // Get last visit date
        const lastVisit = await this.prisma.visitPlan.findFirst({
          where: {
            agencyId: agency.id,
            employeeId,
            status: 'done',
          },
          orderBy: { planDate: 'desc' },
          select: { planDate: true },
        });

        const daysSinceVisit = lastVisit
          ? Math.floor(
              (new Date(date).getTime() - new Date(lastVisit.planDate).getTime()) /
              (1000 * 60 * 60 * 24),
            )
          : 999;

        const isNew = daysSinceVisit > 365;

        // SCORING (0-100 points)
        let score = 0;

        // 1. Days since visit (0-25 points)
        const visitFrequency = this.getVisitFrequency(agency.level);
        const daysSinceScore = Math.min(25, (daysSinceVisit / visitFrequency) * 25);
        score += daysSinceScore;

        // 2. Agency level (0-20 points)
        score += this.getLevelScore(agency.level);

        // 3. Tier (0-10 points)
        score += this.getTierScore(agency.tier);

        // 4. New agency bonus (0-15 points)
        if (isNew) score += 15;

        // 5. Geography bonus (0-10 points)
        if (zone && agency.zone === zone) score += 10;

        return {
          id: agency.id,
          code: agency.code,
          name: agency.name,
          zone: agency.zone,
          level: agency.level,
          tier: agency.tier,
          daysSinceVisit,
          isNew,
          score: Math.round(score),
        };
      }),
    );

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Get optimal 3 agencies for a date
   */
  async getOptimalAssignments(
    employeeId: string,
    date: string,
    count: number = 3,
  ): Promise<AgencyWithScore[]> {
    const scored = await this.scoreAgencies(employeeId, date);
    if (scored.length === 0) throw new Error('No agencies assigned');
    return scored.slice(0, Math.min(count, scored.length));
  }

  /**
   * Get backup agencies
   */
  async getBackupAgencies(
    employeeId: string,
    date: string,
    zone?: string,
    excludeIds: string[] = [],
  ): Promise<AgencyWithScore[]> {
    const all = await this.scoreAgencies(employeeId, date, zone);
    return all.filter(a => !excludeIds.includes(a.id)).slice(0, 5);
  }

  /**
   * Check consecutive assignment
   */
  async checkConsecutiveAssignments(
    employeeId: string,
    agencyId: string,
    date: string,
  ): Promise<{ consecutive: boolean; lastDate?: string }> {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDateStr = nextDay.toISOString().split('T')[0];

    const nextDayPlan = await this.prisma.visitPlan.findFirst({
      where: { employeeId, agencyId, planDate: nextDateStr },
    });

    return nextDayPlan ? { consecutive: true, lastDate: nextDateStr } : { consecutive: false };
  }

  private getVisitFrequency(level: string): number {
    const freq: Record<string, number> = {
      VIP: 4,
      A: 8,
      B: 15,
      C: 30,
      D: 90,
    };
    return freq[level] || 30;
  }

  private getLevelScore(level: string): number {
    const scores: Record<string, number> = {
      VIP: 20,
      A: 15,
      B: 10,
      C: 5,
      D: 0,
    };
    return scores[level] || 0;
  }

  private getTierScore(tier?: string): number {
    const scores: Record<string, number> = {
      platinum: 10,
      gold: 7,
      silver: 5,
      bronze: 2,
      new: 0,
    };
    return scores[tier?.toLowerCase() || 'bronze'] || 0;
  }
}
