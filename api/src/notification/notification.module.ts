import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { SmartNotificationService } from './smart-notification.service';
import { LineService } from './line.service';
import { LineWebhookController } from './line-webhook.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [NotificationController, LineWebhookController],
  providers: [NotificationService, SmartNotificationService, LineService, PrismaService],
  exports: [NotificationService, SmartNotificationService, LineService],
})
export class NotificationModule {}
