import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { AgencyAssignmentEngine } from './agency-assignment.engine';
import { AutoRescheduleService } from './auto-reschedule.service';
import { AssignmentPlannerService } from './assignment-planner.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService, AgencyAssignmentEngine, AutoRescheduleService, AssignmentPlannerService, PrismaService],
  exports: [AssignmentService, AgencyAssignmentEngine, AutoRescheduleService, AssignmentPlannerService],
})
export class AssignmentModule {}
