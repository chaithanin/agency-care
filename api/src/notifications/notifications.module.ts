import { Module } from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class NotificationsModule {}
