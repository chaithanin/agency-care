import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { WorkingDaysCalculator } from './working-days.calculator';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService, WorkingDaysCalculator, PrismaService],
  exports: [AssignmentService, WorkingDaysCalculator],
})
export class AssignmentModule {}
