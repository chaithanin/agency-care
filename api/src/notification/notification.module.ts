import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SmartNotificationService } from './smart-notification.service';
import { LineService } from './line.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, SmartNotificationService, LineService],
  exports: [NotificationService, SmartNotificationService, LineService],
})
export class NotificationModule {}
