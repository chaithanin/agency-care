import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

interface ReqUser { user: { id: string; activeRole?: string; role?: string } }

@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationsController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('year') year?: string) {
    return this.db.employeeEvaluation.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(year ? { year: Number(year) } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, code: true, position: true } },
        evaluatedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  @Post()
  create(@Req() req: ReqUser, @Body() dto: {
    employeeId: string; month: number; year: number;
    kpiScore?: number; behaviorScore?: number; overallScore?: number; grade?: string;
    strengths?: string; improvements?: string; goals?: string;
  }) {
    return this.db.employeeEvaluation.create({
      data: { ...dto, evaluatedById: req.user.id },
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.db.employeeEvaluation.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.db.employeeEvaluation.delete({ where: { id } });
  }

  @Get('trend/:employeeId')
  async trend(@Param('employeeId') employeeId: string) {
    const evals = await this.db.employeeEvaluation.findMany({
      where: { employeeId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    return { trend: evals };
  }
}
