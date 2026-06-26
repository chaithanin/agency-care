import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

interface ReqUser { user: { id: string; activeRole?: string; role?: string; employeeId?: string } }

@Controller('expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  findAll(@Req() req: ReqUser, @Query('employeeId') qEmp?: string, @Query('status') status?: string, @Query('month') month?: string, @Query('year') year?: string) {
    const role = req.user.activeRole ?? req.user.role ?? 'sales';
    const isSales = role === 'sales';
    const empId = isSales ? req.user.employeeId : qEmp;
    return this.db.expenseReport.findMany({
      where: {
        ...(empId ? { employeeId: empId } : {}),
        ...(status ? { status } : {}),
        ...(month && year ? {
          date: { gte: new Date(`${year}-${month.padStart(2,'0')}-01`), lt: new Date(`${year}-${String(Number(month)+1).padStart(2,'0')}-01`) }
        } : year ? { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}),
      },
      include: {
        employee: { select: { id: true, name: true, code: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  @Post()
  create(@Req() req: ReqUser, @Body() dto: {
    employeeId: string; visitPlanId?: string; date: string; category: string; amount: number; description?: string; receiptUrl?: string;
  }) {
    return this.db.expenseReport.create({
      data: { ...dto, date: new Date(dto.date), amount: dto.amount },
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    const data = { ...dto };
    if (data.date) data.date = new Date(data.date as string);
    return this.db.expenseReport.update({ where: { id }, data });
  }

  @Patch(':id/approve')
  approve(@Req() req: ReqUser, @Param('id') id: string, @Body() body: { action: 'approve' | 'reject'; note?: string }) {
    return this.db.expenseReport.update({
      where: { id },
      data: { status: body.action === 'approve' ? 'approved' : 'rejected', approvedById: req.user.id, approvedAt: new Date(), note: body.note },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.db.expenseReport.delete({ where: { id } });
  }

  @Get('summary/:employeeId')
  async summary(@Param('employeeId') employeeId: string, @Query('year') year?: string) {
    const expenses = await this.db.expenseReport.findMany({
      where: {
        employeeId,
        ...(year ? { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } : {}),
      },
    });
    const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byCategory = expenses.reduce((m, e) => {
      m[e.category] = (m[e.category] ?? 0) + Number(e.amount); return m;
    }, {} as Record<string, number>);
    const byStatus = expenses.reduce((m, e) => {
      m[e.status] = (m[e.status] ?? 0) + 1; return m;
    }, {} as Record<string, number>);
    return { totalAmount, totalCount: expenses.length, byCategory, byStatus };
  }
}
