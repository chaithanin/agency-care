import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PosmService } from './posm.service';
import { CreatePosmItemDto, CreatePosmTxnDto, UpdatePosmItemDto } from './dto/posm.dto';
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

  @Roles('admin', 'manager')
  @Post('items')
  createItem(@Body() dto: CreatePosmItemDto) {
    return this.service.createItem(dto);
  }

  @Roles('admin', 'manager')
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
