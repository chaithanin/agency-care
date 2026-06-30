import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { WorkingDaysCalculator } from './working-days.calculator';
import { AgencyAssignmentEngine } from './agency-assignment.engine';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService, WorkingDaysCalculator, AgencyAssignmentEngine, PrismaService],
  exports: [AssignmentService, WorkingDaysCalculator, AgencyAssignmentEngine],
})
export class AssignmentModule {}
