import { Module } from '@nestjs/common';
import { AssignmentPlanService } from './assignment-plan.service';
import { AssignmentPlanController } from './assignment-plan.controller';

@Module({
  providers: [AssignmentPlanService],
  controllers: [AssignmentPlanController],
})
export class AssignmentPlanModule {}
