import { Module } from '@nestjs/common';
import { VisitService } from './visit.service';
import { VisitController } from './visit.controller';
import { TaskModule } from '../task/task.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TaskModule, NotificationModule],
  controllers: [VisitController],
  providers: [VisitService],
})
export class VisitModule {}
