import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

interface ReqUser { user: { id: string; activeRole?: string; role?: string; employeeId?: string } }

@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('year') year?: string) {
    return this.db.trainingRecord.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(year ? { trainingDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}),
      },
      include: { employee: { select: { id: true, name: true, code: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: { trainingDate: 'desc' },
    });
  }

  @Post()
  create(@Req() req: ReqUser, @Body() dto: {
    employeeId: string; trainingName: string; description?: string;
    trainingDate: string; hours?: number; score?: number; passed?: boolean; certificate?: string; notes?: string;
  }) {
    return this.db.trainingRecord.create({
      data: {
        ...dto,
        trainingDate: new Date(dto.trainingDate),
        createdById: req.user.id,
      },
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    const data = { ...dto };
    if (data.trainingDate) data.trainingDate = new Date(data.trainingDate as string);
    return this.db.trainingRecord.update({ where: { id }, data });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.db.trainingRecord.delete({ where: { id } });
  }

  @Get('summary/:employeeId')
  async summary(@Param('employeeId') employeeId: string) {
    const records = await this.db.trainingRecord.findMany({ where: { employeeId } });
    const total = records.length;
    const passed = records.filter(r => r.passed).length;
    const totalHours = records.reduce((s, r) => s + (r.hours ?? 0), 0);
    const avgScore = total ? Math.round(records.reduce((s, r) => s + (r.score ?? 0), 0) / total) : 0;
    return { total, passed, totalHours, avgScore, records };
  }
}
