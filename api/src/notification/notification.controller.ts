import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { NotificationService } from './notification.service';
import { SmartNotificationService } from './smart-notification.service';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

class RunDto {
  @IsOptional()
  @IsString()
  date?: string;
}

class BindLineDto {
  @IsString()
  lineUserId!: string;
}

class SettingPatchDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  channelLine?: boolean;

  @IsOptional()
  @IsBoolean()
  channelEmail?: boolean;

  @IsOptional()
  @IsString()
  cronTime?: string;
}

@Controller('notifications')
export class NotificationController {
  constructor(
    private service: NotificationService,
    private smart: SmartNotificationService,
  ) {}

  // ---- In-App (all roles) ----
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

  // ---- Classic triggers (admin/closer) ----
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

  // ---- Smart Notification Center: Settings ----
  @Roles('admin')
  @Get('smart/settings')
  getSettings() {
    return this.smart.getSettings();
  }

  @Roles('admin')
  @Patch('smart/settings/:notifType')
  updateSetting(@Param('notifType') notifType: string, @Body() dto: SettingPatchDto) {
    return this.smart.updateSetting(notifType, dto);
  }

  // ---- Smart Notification Center: Logs ----
  @Roles('admin', 'closer')
  @Get('smart/logs')
  getLogs(
    @Query('notifType') notifType?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.smart.getLogs({ notifType, status, from, to, limit: limit ? Number(limit) : 200 });
  }

  @Patch('smart/logs/:id/read')
  markLogRead(@Param('id') id: string) {
    return this.smart.markLogRead(id);
  }

  // ---- Smart Notification Center: Manual triggers ----
  @Roles('admin')
  @Post('smart/send/:type')
  sendSmart(@Param('type') type: string, @Body() dto: RunDto) {
    return this.smart.sendTest(type as 'daily_brief' | 'midday' | 'afternoon' | 'evening', dto.date);
  }

  // ---- LINE Account Binding ----
  @Post('bind-line')
  async bindLine(@CurrentUser() user: RequestUser, @Body() dto: BindLineDto) {
    if (!user.employeeId) return { ok: false, message: 'ไม่พบข้อมูลพนักงาน' };
    await this.service.createInApp(user.id, 'ผูก LINE สำเร็จ', 'คุณจะได้รับการแจ้งเตือนผ่าน LINE OA แล้ว', 'line_bind', '/profile');
    return this.smart.bindLine(user.employeeId, dto.lineUserId);
  }

  @Patch('unbind-line')
  unbindLine(@CurrentUser() user: RequestUser) {
    if (!user.employeeId) return { ok: false, message: 'ไม่พบข้อมูลพนักงาน' };
    return this.smart.unbindLine(user.employeeId);
  }
}
