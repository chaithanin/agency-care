import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AgencyWithScore {
  id: string;
  code: string;
  name: string;
  zone?: string;
  vipLevel: number;
  riskScore: number;
  daysSinceVisit: number;
  isNew: boolean;
  score: number;
  priority: number; // 1=highest, 10=lowest
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
    date: string, // YYYY-MM-DD (the day to assign)
    zone?: string, // Filter by zone (geographic clustering)
  ): Promise<AgencyWithScore[]> {
    // Get all active agencies assigned to this employee
    const assignments = await this.prisma.agencyAssignment.findMany({
      where: { employeeId, isActive: true },
      include: {
        agency: {
          select: {
            id: true,
            code: true,
            name: true,
            zone: true,
            vipLevel: true,
            aiRiskScore: true,
            tier: true,
          },
        },
      },
    });

    // Filter by zone if provided (geographic clustering)
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
          : 999; // New agency

        const isNew = daysSinceVisit > 365;
        const riskScore = agency.aiRiskScore || 0;

        // SCORING ALGORITHM (0-100 points total)
        let score = 0;

        // 1. Days Since Last Visit (0-25 points)
        // VIP: 8/month = 3.75 days ideal, score decreases if overdue
        // A: 4/month = 7.5 days
        // B: 2/month = 15 days
        // C: 1/month = 30 days
        // D: 1/3months = 90 days
        const visitFrequencyDays = this.getVisitFrequencyDays(agency.vipLevel);
        const daysSinceScore = Math.min(
          25,
          (daysSinceVisit / visitFrequencyDays) * 25,
        );
        score += daysSinceScore;

        // 2. VIP Level (0-20 points)
        // VIP = 20, A = 15, B = 10, C = 5, D = 0
        const vipScore = this.getVIPScore(agency.vipLevel);
        score += vipScore;

        // 3. AI Risk Score (0-20 points)
        // Higher risk = higher priority
        const riskScorePoints = (riskScore / 100) * 20;
        score += riskScorePoints;

        // 4. New Agency (0-15 points)
        // Prioritize new agencies to get them in rotation
        if (isNew) {
          score += 15;
        }

        // 5. Tier/Category (0-10 points)
        const tierScore = this.getTierScore(agency.tier);
        score += tierScore;

        // 6. Geographic bonus (0-10 points)
        // Same zone bonus for route clustering
        if (zone && agency.zone === zone) {
          score += 5;
        }

        return {
          id: agency.id,
          code: agency.code,
          name: agency.name,
          zone: agency.zone,
          vipLevel: agency.vipLevel,
          riskScore,
          daysSinceVisit,
          isNew,
          score: Math.round(score),
          priority: 0, // Will be set after sorting
        };
      }),
    );

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Assign priority (1=highest)
    scored.forEach((a, i) => {
      a.priority = i + 1;
    });

    return scored;
  }

  /**
   * Get optimal agencies to visit for a specific date
   * Returns 3 agencies sorted by route (geographic clustering)
   */
  async getOptimalAssignments(
    employeeId: string,
    date: string,
    count: number = 3,
  ): Promise<AgencyWithScore[]> {
    // Score all agencies
    const scored = await this.scoreAgencies(employeeId, date);

    if (scored.length === 0) {
      throw new Error('No agencies assigned to this employee');
    }

    // Take top N by score
    const top = scored.slice(0, count);

    // If we got fewer than requested, fill with next highest
    if (top.length < count) {
      top.push(...scored.slice(count, count * 2));
    }

    // TODO: Phase 3 - Route optimization
    // For now, just sort by priority within same zone
    top.sort((a, b) => {
      // Prefer same zone grouping
      if (a.zone && b.zone && a.zone !== b.zone) {
        return a.zone.localeCompare(b.zone);
      }
      // Then by priority
      return a.priority - b.priority;
    });

    return top;
  }

  /**
   * Check if assigning same agency on consecutive days
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
      where: {
        employeeId,
        agencyId,
        planDate: nextDateStr,
      },
    });

    if (nextDayPlan) {
      return { consecutive: true, lastDate: nextDateStr };
    }

    return { consecutive: false };
  }

  /**
   * Suggest backup agencies if primary can't go
   */
  async getBackupAgencies(
    employeeId: string,
    date: string,
    zone?: string,
    excludeIds: string[] = [],
  ): Promise<AgencyWithScore[]> {
    const all = await this.scoreAgencies(employeeId, date, zone);

    // Exclude already assigned + primary agencies
    return all
      .filter(a => !excludeIds.includes(a.id))
      .slice(0, 5);
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  private getVisitFrequencyDays(vipLevel: string | number): number {
    const level = typeof vipLevel === 'string' ? vipLevel : String.fromCharCode(65 + vipLevel);
    const freq: Record<string, number> = {
      VIP: 4, // 8 times/month ≈ 3.75 days
      A: 8, // 4 times/month ≈ 7.5 days
      B: 15, // 2 times/month ≈ 15 days
      C: 30, // 1 time/month
      D: 90, // 1 time/3 months
    };
    return freq[level] || 30;
  }

  private getVIPScore(vipLevel: string | number): number {
    const level = typeof vipLevel === 'string' ? vipLevel : String.fromCharCode(65 + vipLevel);
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
      standard: 0,
      premium: 5,
      vip: 10,
    };
    return scores[tier?.toLowerCase() || 'standard'] || 0;
  }
}
