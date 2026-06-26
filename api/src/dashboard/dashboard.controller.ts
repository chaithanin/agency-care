import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/guards';

@Roles('admin', 'closer')
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.service.summary(date);
  }

  @Get('weekly')
  weekly() {
    return this.service.weekly();
  }

  @Get('today-plans')
  todayPlans(@Query('date') date?: string) {
    return this.service.todayPlans(date);
  }
}
