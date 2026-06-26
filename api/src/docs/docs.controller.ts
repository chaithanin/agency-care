import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { DocsService } from './docs.service';

@Controller('docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private readonly svc: DocsService) {}

  private role(req: { user: { activeRole?: string; role?: string } }) {
    return req.user.activeRole ?? req.user.role ?? 'sales';
  }

  @Get('dashboard')
  dashboard(@Query('type') docType?: string, @Query('year') year?: string) {
    return this.svc.dashboard(docType, year ? Number(year) : undefined);
  }

  @Post()
  create(@Req() req: { user: { id: string; activeRole?: string; role?: string } }, @Body() dto: Record<string, unknown>) {
    return this.svc.create(req.user.id, dto as never);
  }

  @Get()
  findAll(@Req() req: { user: { id: string; activeRole?: string; role?: string; employeeId?: string } }, @Query() q: Record<string, string>) {
    const role = this.role(req);
    const filters: Record<string, unknown> = {
      docType: q.type,
      status: q.status,
      month: q.month ? Number(q.month) : undefined,
      year: q.year ? Number(q.year) : undefined,
      search: q.search,
      limit: q.limit ? Number(q.limit) : 50,
      offset: q.offset ? Number(q.offset) : 0,
    };
    // Sales see only their own
    if (role === 'sales' && req.user.employeeId) {
      filters.employeeId = req.user.employeeId;
    }
    return this.svc.findAll(filters);
  }

  @Get(':id')
  findOne(@Req() req: { user: { id: string; activeRole?: string; role?: string } }, @Param('id') id: string) {
    return this.svc.findOne(id, req.user.id, this.role(req));
  }

  @Patch(':id')
  update(@Req() req: { user: { id: string; activeRole?: string; role?: string } }, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.svc.update(id, req.user.id, this.role(req), dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Req() req: { user: { id: string; activeRole?: string; role?: string } },
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.svc.changeStatus(id, req.user.id, this.role(req), body.status, body.note);
  }

  @Post(':id/generate-schedule')
  generateSvaSchedule(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: { agencies: Array<{ id?: string; name: string; province: string; contactPerson?: string; level?: string }> },
  ) {
    return this.svc.generateSvaSchedule(id, req.user.id, dto);
  }

  @Post(':id/rows')
  addRow(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.svc.addRow(id, dto);
  }

  @Patch(':id/rows/:rowId')
  updateRow(@Param('id') id: string, @Param('rowId') rowId: string, @Body() dto: Record<string, unknown>) {
    return this.svc.updateRow(id, rowId, dto);
  }

  @Delete(':id/rows/:rowId')
  deleteRow(@Param('id') id: string, @Param('rowId') rowId: string) {
    return this.svc.deleteRow(id, rowId);
  }

  @Post(':id/sign')
  addSignature(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: { signerType: string; signatureData: string },
  ) {
    return this.svc.addSignature(id, req.user.id, dto);
  }

  @Delete(':id/signatures/:sigId')
  revokeSignature(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('sigId') sigId: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.revokeSignature(id, sigId, req.user.id, body.reason);
  }

  @Get(':id/audit')
  auditLogs(@Param('id') id: string) {
    return this.svc.getAuditLogs(id);
  }

  @Post(':id/version')
  createVersion(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.svc.createNewVersion(id, req.user.id, body.reason);
  }
}
