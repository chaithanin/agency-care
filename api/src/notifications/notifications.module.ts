import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PrModule } from '../pr/pr.module';

@Module({
  imports: [PrismaModule, NotificationModule, PrModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class NotificationsModule {}
