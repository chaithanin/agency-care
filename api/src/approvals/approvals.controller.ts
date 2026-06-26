import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

interface ReqUser { user: { id: string; activeRole?: string; role?: string; employeeId?: string } }

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly db: PrismaService) {}

  /** Unified queue — returns all pending items across all modules */
  @Get('queue')
  async queue(@Req() req: ReqUser, @Query('module') module?: string) {
    const role = req.user.activeRole ?? req.user.role ?? 'sales';
    const isApprover = ['admin', 'super_admin', 'closer'].includes(role);
    if (!isApprover) return { items: [], total: 0 };

    const results: unknown[] = [];

    if (!module || module === 'leave') {
      const leaves = await this.db.leaveRequest.findMany({
        where: { status: 'pending' },
        include: { employee: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      results.push(...leaves.map(l => ({ ...l, _module: 'leave', _label: `ลาหยุด: ${l.employee.name}` })));
    }

    if (!module || module === 'pr') {
      const prs = await this.db.purchaseRequest.findMany({
        where: { status: 'waiting_approval' },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      results.push(...prs.map(p => ({ ...p, _module: 'pr', _label: `PR: ${p.title}` })));
    }

    if (!module || module === 'document') {
      const docs = await this.db.documentRecord.findMany({
        where: { status: 'pending_approval' },
        include: {
          employee: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      results.push(...docs.map(d => ({ ...d, _module: 'document', _label: `Doc: ${d.docNumber ?? d.id.slice(0,8)} (${d.docType.toUpperCase()})` })));
    }

    if (!module || module === 'expense') {
      const expenses = await this.db.expenseReport.findMany({
        where: { status: 'pending' },
        include: { employee: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      results.push(...expenses.map(e => ({ ...e, _module: 'expense', _label: `ค่าใช้จ่าย: ${e.employee.name} ฿${e.amount}` })));
    }

    if (!module || module === 'agency') {
      const agencies = await this.db.agency.findMany({
        where: { approvalStatus: 'pending' },
        include: { addedBy: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      results.push(...agencies.map(a => ({ ...a, _module: 'agency', _label: `Agency: ${a.name}` })));
    }

    results.sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return { items: results, total: results.length };
  }

  /** Approve/reject an item */
  @Patch(':module/:id/action')
  async doAction(
    @Req() req: ReqUser,
    @Param('module') module: string,
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; note?: string },
  ) {
    const { action, note } = body;
    const userId = req.user.id;
    const now = new Date();

    if (module === 'leave') {
      return this.db.leaveRequest.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedById: userId,
          approvedAt: now,
          ...(action === 'reject' && note ? { rejectedReason: note } : {}),
        },
      });
    }
    if (module === 'pr') {
      return this.db.purchaseRequest.update({
        where: { id },
        data: { status: action === 'approve' ? 'approved' : 'rejected', approverId: userId, approvedAt: now },
      });
    }
    if (module === 'document') {
      return this.db.documentRecord.update({
        where: { id },
        data: { status: action === 'approve' ? 'approved' : 'cancelled', approvedById: userId, approvedAt: now },
      });
    }
    if (module === 'expense') {
      return this.db.expenseReport.update({
        where: { id },
        data: { status: action === 'approve' ? 'approved' : 'rejected', approvedById: userId, approvedAt: now, note },
      });
    }
    if (module === 'agency') {
      return this.db.agency.update({
        where: { id },
        data: { approvalStatus: action === 'approve' ? 'approved' : 'rejected' },
      });
    }

    return { error: 'Unknown module' };
  }

  /** Statistics */
  @Get('stats')
  async stats() {
    const [leaves, prs, docs, expenses, agencies] = await Promise.all([
      this.db.leaveRequest.count({ where: { status: 'pending' } }),
      this.db.purchaseRequest.count({ where: { status: 'waiting_approval' } }),
      this.db.documentRecord.count({ where: { status: 'pending_approval' } }),
      this.db.expenseReport.count({ where: { status: 'pending' } }),
      this.db.agency.count({ where: { approvalStatus: 'pending' } }),
    ]);
    return { leave: leaves, pr: prs, document: docs, expense: expenses, agency: agencies, total: leaves + prs + docs + expenses + agencies };
  }
}
