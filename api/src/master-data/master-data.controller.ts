import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

@Controller('master-data')
@UseGuards(JwtAuthGuard)
export class MasterDataController {
  constructor(private readonly db: PrismaService) {}

  // ── Regions ─────────────────────────────────────────────────────
  @Get('regions')
  regions() {
    return this.db.region.findMany({ orderBy: { code: 'asc' }, include: { branches: true } });
  }
  @Post('regions')
  createRegion(@Body() b: { code: string; name: string }) {
    return this.db.region.create({ data: b });
  }
  @Patch('regions/:id')
  updateRegion(@Param('id') id: string, @Body() b: Record<string, unknown>) {
    return this.db.region.update({ where: { id }, data: b });
  }
  @Delete('regions/:id')
  deleteRegion(@Param('id') id: string) {
    return this.db.region.delete({ where: { id } });
  }

  // ── Branches ─────────────────────────────────────────────────────
  @Get('branches')
  branches(@Query('regionId') regionId?: string) {
    return this.db.branch.findMany({
      where: regionId ? { regionId } : {},
      orderBy: { code: 'asc' },
      include: { region: true },
    });
  }
  @Post('branches')
  createBranch(@Body() b: { code: string; name: string; regionId?: string }) {
    return this.db.branch.create({ data: b });
  }
  @Patch('branches/:id')
  updateBranch(@Param('id') id: string, @Body() b: Record<string, unknown>) {
    return this.db.branch.update({ where: { id }, data: b });
  }
  @Delete('branches/:id')
  deleteBranch(@Param('id') id: string) {
    return this.db.branch.delete({ where: { id } });
  }

  // ── Departments ──────────────────────────────────────────────────
  @Get('departments')
  departments() {
    return this.db.department.findMany({ orderBy: { code: 'asc' } });
  }
  @Post('departments')
  createDept(@Body() b: { code: string; name: string; managerId?: string }) {
    return this.db.department.create({ data: b });
  }
  @Patch('departments/:id')
  updateDept(@Param('id') id: string, @Body() b: Record<string, unknown>) {
    return this.db.department.update({ where: { id }, data: b });
  }
  @Delete('departments/:id')
  deleteDept(@Param('id') id: string) {
    return this.db.department.delete({ where: { id } });
  }

  // ── Generic MasterData (visit_type, task_type, etc.) ─────────────
  @Get('items')
  items(@Query('category') category?: string) {
    return this.db.masterData.findMany({
      where: category ? { category } : {},
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }
  @Get('items/:category')
  itemsByCategory(@Param('category') category: string) {
    return this.db.masterData.findMany({
      where: { category, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
  @Post('items')
  createItem(@Body() b: { category: string; code: string; nameEn: string; nameTh: string; sortOrder?: number }) {
    return this.db.masterData.create({ data: b });
  }
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() b: Record<string, unknown>) {
    return this.db.masterData.update({ where: { id }, data: b });
  }
  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.db.masterData.delete({ where: { id } });
  }

  // ── Approval Rules ───────────────────────────────────────────────
  @Get('approval-rules')
  approvalRules() {
    return this.db.approvalRule.findMany({ orderBy: { module: 'asc' } });
  }
  @Patch('approval-rules/:id')
  updateApprovalRule(@Param('id') id: string, @Body() b: Record<string, unknown>) {
    return this.db.approvalRule.update({ where: { id }, data: b });
  }
}
