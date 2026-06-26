import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PrService, CreatePrDto, UpdatePrDto, PrStatus } from './pr.service';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('pr')
export class PrController {
  constructor(private service: PrService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: RequestUser) {
    return this.service.dashboard(user.activeRole ?? user.role, user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePrDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('department') department?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      userId: user.id,
      userRole: user.activeRole ?? user.role,
      employeeId: user.employeeId,
      status, priority, department, from, to, search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('export')
  @Roles('admin', 'closer')
  exportData(@Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.exportData({ status, from, to });
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.findOne(id, user.id, user.activeRole ?? user.role);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdatePrDto) {
    return this.service.update(id, user.id, user.activeRole ?? user.role, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { status: PrStatus; note?: string },
  ) {
    return this.service.changeStatus(id, user.id, user.activeRole ?? user.role, body.status, body.note);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: RequestUser,
    @Param('id') prId: string,
    @Body() body: { message: string },
  ) {
    return this.service.addComment(prId, user.id, body.message);
  }

  @Patch(':id/checklists/:checklistId')
  toggleChecklist(
    @CurrentUser() user: RequestUser,
    @Param('id') prId: string,
    @Param('checklistId') checklistId: string,
    @Body() body: { isDone: boolean },
  ) {
    return this.service.toggleChecklist(prId, checklistId, user.id, body.isDone);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: RequestUser,
    @Param('id') prId: string,
    @Body() body: { name: string; detail?: string; qty: number; unit?: string; budget?: number; neededBy?: string },
  ) {
    return this.service.addItem(prId, user.id, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(@CurrentUser() user: RequestUser, @Param('id') prId: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(prId, itemId, user.id);
  }

  @Post(':id/attachments')
  addAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') prId: string,
    @Body() body: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string },
  ) {
    return this.service.addAttachment(prId, user.id, body);
  }

  @Delete(':id/attachments/:attId')
  deleteAttachment(
    @CurrentUser() user: RequestUser,
    @Param('id') prId: string,
    @Param('attId') attId: string,
  ) {
    return this.service.deleteAttachment(prId, attId, user.id, user.activeRole ?? user.role);
  }
}
