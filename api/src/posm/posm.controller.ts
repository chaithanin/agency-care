import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PosmService } from './posm.service';
import { AdjustStockDto, CreatePosmItemDto, CreatePosmTxnDto, UpdatePosmItemDto } from './dto/posm.dto';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('posm')
export class PosmController {
  constructor(private service: PosmService) {}

  // master — อ่านได้ทุก role (sales ต้องเห็นรายการตอนแจก)
  @Get('items')
  listItems() {
    return this.service.listItems();
  }

  // คลังสื่อ + แจ้งเตือนสต็อกต่ำ
  @Roles('admin', 'closer')
  @Get('inventory')
  inventory() {
    return this.service.inventory();
  }

  // Distribution Log — รายการแจกทั้งหมด (ต้องอยู่ก่อน :id routes)
  @Roles('admin', 'closer')
  @Get('distribution-log')
  distributionLog(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agencyId') agencyId?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.service.distributionLog({ from, to, agencyId, itemId });
  }

  // สรุปสื่อที่แจกต่อ Agency
  @Roles('admin', 'closer')
  @Get('agency-summary')
  agencySummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agencyId') agencyId?: string,
  ) {
    return this.service.agencySummary({ from, to, agencyId });
  }

  @Roles('admin', 'closer')
  @Post('items/:id/adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.service.adjustStock(id, dto.delta);
  }

  @Roles('admin', 'closer')
  @Post('items')
  createItem(@Body() dto: CreatePosmItemDto) {
    return this.service.createItem(dto);
  }

  @Roles('admin', 'closer')
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdatePosmItemDto) {
    return this.service.updateItem(id, dto);
  }

  // แจกสื่อในงานเยี่ยม
  @Post('transactions')
  giveOut(@CurrentUser() user: RequestUser, @Body() dto: CreatePosmTxnDto) {
    return this.service.giveOut(user, dto);
  }

  @Get('transactions')
  listByVisit(@Query('visitPlanId') visitPlanId: string) {
    return this.service.listByVisit(visitPlanId);
  }
}
