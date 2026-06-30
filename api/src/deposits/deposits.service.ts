import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepositsService {
  private logger = new Logger(DepositsService.name);

  constructor(private prisma: PrismaService) {}

  async createDeposit(leadId: string, dto: any) {
    return this.prisma.agencyDeposit.create({
      data: {
        leadId,
        depositAmount: dto.depositAmount,
        depositCurrency: dto.depositCurrency || 'THB',
        depositDate: dto.depositDate,
        depositStatus: 'pending',
        paymentMethod: dto.paymentMethod,
        bankAccount: dto.bankAccount,
        transferReference: dto.transferReference,
      },
      include: { transactions: true },
    });
  }

  async getDeposit(leadId: string) {
    return this.prisma.agencyDeposit.findUnique({
      where: { leadId },
      include: {
        transactions: { orderBy: { transactionDate: 'desc' } },
      },
    });
  }

  async updateDeposit(id: string, dto: any) {
    const deposit = await this.prisma.agencyDeposit.findUnique({ where: { id } });
    if (!deposit) throw new Error('Deposit not found');

    const updated = await this.prisma.agencyDeposit.update({
      where: { id },
      data: {
        depositAmount: dto.depositAmount ?? deposit.depositAmount,
        depositDate: dto.depositDate ?? deposit.depositDate,
        depositStatus: dto.depositStatus ?? deposit.depositStatus,
        paymentMethod: dto.paymentMethod ?? deposit.paymentMethod,
        bankAccount: dto.bankAccount ?? deposit.bankAccount,
        transferReference: dto.transferReference ?? deposit.transferReference,
        aiRiskScore: this.calculateRiskScore(dto, deposit),
      },
      include: { transactions: true },
    });

    return updated;
  }

  async addTransaction(depositId: string, recordedById: string, dto: any) {
    const deposit = await this.prisma.agencyDeposit.findUnique({
      where: { id: depositId },
    });
    if (!deposit) throw new Error('Deposit not found');

    const transaction = await this.prisma.depositTransaction.create({
      data: {
        depositId,
        transactionType: dto.transactionType,
        amount: dto.amount,
        transactionDate: dto.transactionDate || new Date(),
        reference: dto.reference,
        notes: dto.notes,
        recordedById,
      },
    });

    await this.updateDeposit(depositId, { depositStatus: dto.updateStatus });
    return transaction;
  }

  async getDashboard() {
    const deposits = await this.prisma.agencyDeposit.findMany({
      include: { transactions: true },
    });

    const totalDeposited = deposits
      .filter(d => d.depositStatus === 'confirmed' || d.depositStatus === 'completed')
      .reduce((sum, d) => sum + Number(d.depositAmount), 0);

    const pending = deposits.filter(d => d.depositStatus === 'pending').length;
    const atRisk = deposits.filter(d => (d.aiRiskScore || 0) >= 70).length;
    const collected = deposits.filter(d => d.depositStatus === 'confirmed' || d.depositStatus === 'completed').length;
    const total = deposits.length;

    return {
      totalDeposited,
      pending,
      atRisk,
      collected,
      total,
      collectionRate: total > 0 ? Math.round((collected / total) * 100) : 0,
    };
  }

  async getRiskAnalysis(id: string) {
    const deposit = await this.prisma.agencyDeposit.findUnique({
      where: { id },
      include: { transactions: true, lead: true },
    });
    if (!deposit) throw new Error('Deposit not found');

    const riskScore = this.calculateRiskScore({}, deposit);
    const factors: string[] = [];

    const daysOld = Math.floor(
      (new Date().getTime() - new Date(deposit.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysOld > 30) factors.push(`${daysOld} days since deposit created`);

    const lastFollowup = deposit.lastFollowupDate
      ? Math.floor(
          (new Date().getTime() - new Date(deposit.lastFollowupDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : daysOld;
    if (lastFollowup >= 5) factors.push(`${lastFollowup} days since last follow-up`);

    if (deposit.depositStatus === 'pending' && daysOld > 7) {
      factors.push(`Overdue payment by ${daysOld - 7} days`);
    }

    let recommendation = 'Monitor';
    if (riskScore < 40) recommendation = 'Monitor';
    else if (riskScore < 70) recommendation = 'Contact within 2 days';
    else recommendation = 'Call immediately - consider involving closer';

    return {
      riskScore,
      factors,
      recommendation,
      depositAmount: deposit.depositAmount,
      daysPending: daysOld,
      lastFollowupDaysAgo: lastFollowup,
    };
  }

  private calculateRiskScore(dto: any, deposit: any): number {
    let score = 0;

    const daysOld = Math.floor(
      (new Date().getTime() - new Date(deposit.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysOld > 7) score += Math.min(daysOld, 20);
    if (daysOld > 30) score += 10;

    const lastFollowup = deposit.lastFollowupDate
      ? Math.floor(
          (new Date().getTime() - new Date(deposit.lastFollowupDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : daysOld;

    if (lastFollowup >= 5) score += 20;
    if (lastFollowup >= 10) score += 15;

    if (deposit.depositStatus === 'pending') {
      score += 10;
      if (daysOld > 14) score += 15;
    }

    return Math.min(score, 100);
  }
}
