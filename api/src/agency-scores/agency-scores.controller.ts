import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

interface ReqUser { user: { id: string } }

@Controller('agency-scores')
@UseGuards(JwtAuthGuard)
export class AgencyScoresController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  findAll(@Query('agencyId') agencyId?: string, @Query('year') year?: string, @Query('month') month?: string) {
    return this.db.agencyScore.findMany({
      where: {
        ...(agencyId ? { agencyId } : {}),
        ...(year ? { year: Number(year) } : {}),
        ...(month ? { month: Number(month) } : {}),
      },
      include: { agency: { select: { id: true, name: true, code: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  @Post()
  create(@Req() req: ReqUser, @Body() dto: {
    agencyId: string; month: number; year: number;
    visitScore?: number; salesScore?: number; growthScore?: number; riskScore?: number; overallScore?: number; grade?: string; notes?: string;
  }) {
    return this.db.agencyScore.create({ data: { ...dto, createdById: req.user.id } });
  }

  @Post('bulk-calculate')
  async bulkCalculate(@Req() req: ReqUser, @Body() body: { month: number; year: number }) {
    const { month, year } = body;
    const agencies = await this.db.agency.findMany({ where: { status: 'active' } });
    const results = [];

    for (const agency of agencies) {
      const visitCount = await this.db.visitPlan.count({
        where: { agencyId: agency.id, planDate: { gte: new Date(`${year}-${String(month).padStart(2,'0')}-01`) } },
      });
      const visitScore = Math.min(100, visitCount * 10);
      const overallScore = visitScore;
      const grade = overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B' : overallScore >= 40 ? 'C' : 'D';

      const result = await this.db.agencyScore.upsert({
        where: { agencyId_year_month: { agencyId: agency.id, year, month } },
        create: { agencyId: agency.id, month, year, visitScore, overallScore, grade, createdById: req.user.id },
        update: { visitScore, overallScore, grade },
      });
      results.push(result);
    }
    return { calculated: results.length, results };
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.db.agencyScore.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.db.agencyScore.delete({ where: { id } });
  }

  @Get('leaderboard')
  async leaderboard(@Query('year') year?: string, @Query('month') month?: string) {
    const scores = await this.db.agencyScore.findMany({
      where: {
        ...(year ? { year: Number(year) } : {}),
        ...(month ? { month: Number(month) } : {}),
      },
      include: { agency: { select: { id: true, name: true, code: true, level: true } } },
      orderBy: { overallScore: 'desc' },
      take: 20,
    });
    return scores;
  }
}
