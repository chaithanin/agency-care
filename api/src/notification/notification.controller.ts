import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { NotificationService } from './notification.service';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

class RunDto {
  @IsOptional()
  @IsString()
  date?: string;
}

@Controller('notifications')
export class NotificationController {
  constructor(private service: NotificationService) {}

  // ---- In-App (ทุก role) ----
  @Get('my')
  getMyNotifications(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.service.getMyNotifications(user.id, limit ? Number(limit) : 50);
  }

  @Get('my/unread-count')
  getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.service.getUnreadCount(user.id);
  }

  @Patch('my/:id/read')
  markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }

  @Patch('my/read-all')
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.service.markAllRead(user.id);
  }

  // ---- Admin/Closer triggers ----
  @Roles('admin', 'closer')
  @Post('run')
  run(@Body() dto: RunDto) {
    return this.service.notifyPendingVisits(dto.date);
  }

  @Roles('admin', 'closer')
  @Post('daily-schedule')
  dailySchedule(@Body() dto: RunDto) {
    return this.service.notifyDailySchedule(dto.date);
  }

  @Roles('admin', 'closer')
  @Post('tomorrow-schedule')
  tomorrowSchedule(@Body() dto: RunDto) {
    return this.service.notifyTomorrowSchedule(dto.date);
  }

  @Roles('admin', 'closer')
  @Post('team-no-checkin')
  teamNoCheckin(@Body() dto: RunDto) {
    return this.service.notifyTeamNoCheckin(dto.date);
  }

  @Roles('admin', 'closer')
  @Post('low-plan')
  lowPlan(@Body() dto: RunDto) {
    return this.service.notifyLowPlanCount(dto.date);
  }

  @Roles('admin', 'closer')
  @Post('daily-summary')
  dailySummary(@Body() dto: RunDto) {
    return this.service.dailyAdminSummary(dto.date);
  }
}
