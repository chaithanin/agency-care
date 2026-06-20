import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SalesService, CreateSalesDto } from './sales.service';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('sales')
export class SalesController {
  constructor(private service: SalesService) {}

  @Post()
  record(@CurrentUser() user: RequestUser, @Body() dto: CreateSalesDto) {
    return this.service.record(user, dto);
  }

  @Get()
  listByVisit(@Query('visitPlanId') visitPlanId: string) {
    return this.service.listByVisit(visitPlanId);
  }
}
