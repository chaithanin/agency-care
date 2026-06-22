import { Body, Controller, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { NotificationService } from './notification.service';
import { Roles } from '../auth/guards';

class RunDto {
  @IsOptional()
  @IsString()
  date?: string;
}

@Roles('admin', 'manager')
@Controller('notifications')
export class NotificationController {
  constructor(private service: NotificationService) {}

  // ทริกเกอร์แจ้งเตือนงานค้างทันที
  @Post('run')
  run(@Body() dto: RunDto) {
    return this.service.notifyPendingVisits(dto.date);
  }

  // push ตารางงานวันนี้ให้พนักงานทุกคน (LINE)
  @Post('daily-schedule')
  dailySchedule(@Body() dto: RunDto) {
    return this.service.notifyDailySchedule(dto.date);
  }
}
