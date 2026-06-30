import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { AgencyAssignmentEngine } from './agency-assignment.engine';
import { AutoRescheduleService } from './auto-reschedule.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService, AgencyAssignmentEngine, AutoRescheduleService, PrismaService],
  exports: [AssignmentService, AgencyAssignmentEngine, AutoRescheduleService],
})
export class AssignmentModule {}
