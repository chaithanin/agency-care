import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/guards';

@Roles('admin', 'manager')
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.service.summary(date);
  }
}
