import { Module } from '@nestjs/common';
import { VisitService } from './visit.service';
import { VisitController } from './visit.controller';
import { TaskModule } from '../task/task.module';

@Module({
  imports: [TaskModule],
  controllers: [VisitController],
  providers: [VisitService],
})
export class VisitModule {}
