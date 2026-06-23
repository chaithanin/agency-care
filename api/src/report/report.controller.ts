import { Controller, Get, Query } from '@nestjs/common';
import { ReportService } from './report.service';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { Roles } from '../auth/guards';

@Controller('reports')
export class ReportController {
  constructor(private service: ReportService) {}

  @Roles('admin', 'closer', 'sales')
  @Get('weekly-activity')
  weeklyActivity(
    @CurrentUser() user: RequestUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.service.weeklyActivity(user, from ?? today, to ?? today);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('monthly-submission')
  monthlySubmission(
    @CurrentUser() user: RequestUser,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.service.monthlySubmission(
      user,
      year ? Number(year) : now.getFullYear(),
      month ? Number(month) : now.getMonth() + 1,
    );
  }

  @Roles('admin', 'closer')
  @Get('agency-performance')
  agencyPerformance(
    @CurrentUser() user: RequestUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = today.slice(0, 8) + '01';
    return this.service.agencyPerformance(user, from ?? firstOfMonth, to ?? today);
  }
}
