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

  @Roles('admin', 'closer', 'sales')
  @Get('agency-activity')
  agencyActivity(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const firstOfYear = today.slice(0, 4) + '-01-01';
    return this.service.agencyActivity(from ?? firstOfYear, to ?? today, employeeId);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('daily-tracker')
  dailyTracker(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('half') half: string,
  ) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    const h = (half === '2' ? 2 : 1) as 1 | 2;
    return this.service.dailyTracker(y, m, h);
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
