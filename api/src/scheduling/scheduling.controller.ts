import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { Roles } from '../auth/guards';
import { CurrentUser } from '../common/current-user.decorator';

const toInt = (v?: string) => (v ? parseInt(v, 10) : undefined);

@Controller('scheduling')
export class SchedulingController {
  constructor(private service: SchedulingService) {}

  // ----- ผู้บริหาร/หัวหน้า -----
  @Roles('admin', 'manager')
  @Get('team-dashboard')
  teamDashboard(@Query('year') y?: string, @Query('month') m?: string) {
    return this.service.teamDashboard(toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Get('coverage')
  coverage(@Query('year') y?: string, @Query('month') m?: string) {
    return this.service.coverageStatus(toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Get('monthly-dashboard')
  monthlyDashboard(@Query('year') y?: string, @Query('month') m?: string) {
    return this.service.monthlyDashboard(toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Get('live')
  live() {
    return this.service.liveStatus();
  }

  @Roles('admin', 'manager')
  @Get('calendar')
  calendar(@Query('year') y?: string, @Query('month') m?: string, @Query('employeeId') employeeId?: string) {
    return this.service.calendar(toInt(y), toInt(m), employeeId);
  }

  // วันหยุดราย user
  @Roles('admin', 'manager')
  @Get('holidays')
  listHolidays(@Query('employeeId') employeeId: string, @Query('year') y?: string, @Query('month') m?: string) {
    return this.service.listHolidays(employeeId, toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Post('holidays/toggle')
  toggleHoliday(@Body() body: { employeeId: string; date: string }) {
    return this.service.toggleHoliday(body.employeeId, body.date);
  }

  @Roles('admin', 'manager')
  @Get('office')
  office(@Query('date') date?: string) {
    return this.service.officeStatus(date);
  }

  @Roles('admin', 'manager')
  @Get('new-agency')
  newAgency(@Query('year') y?: string, @Query('month') m?: string) {
    return this.service.newAgencyStatus(toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Get('unmet')
  unmet(@Query('year') y?: string, @Query('month') m?: string) {
    return this.service.unmetAgencies(toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Get('teams')
  teams() {
    return this.service.teams();
  }

  @Roles('admin', 'manager')
  @Get('seller-performance')
  sellerPerformance(
    @Query('employeeId') employeeId?: string,
    @Query('year') y?: string,
    @Query('month') m?: string,
  ) {
    return this.service.sellerPerformance(employeeId, toInt(y), toInt(m));
  }

  @Roles('admin', 'manager')
  @Get('daily')
  daily(@Query('date') date: string, @Query('employeeId') employeeId?: string) {
    return this.service.dailySchedules(date, employeeId);
  }

  // สร้าง/รีเฟรชแผนทั้งเดือน (AI auto-scheduler)
  @Roles('admin', 'manager')
  @Post('generate-month')
  generateMonth(@Body() body: { year?: number; month?: number }) {
    return this.service.generateMonth(body?.year, body?.month);
  }

  // วางแผนราย 2 สัปดาห์ (เริ่มจากวันที่ระบุ หรือวันนี้)
  @Roles('admin', 'manager')
  @Post('generate-fortnight')
  generateFortnight(@Body() body: { from?: string }) {
    return this.service.generateFortnight(body?.from);
  }

  // ----- พนักงานดูงานตัวเอง -----
  @Get('my-day')
  myDay(@CurrentUser('id') userId: string, @Query('date') date?: string) {
    return this.service.myDay(userId, date);
  }
}
