import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { AssignmentController } from './assignment.controller';
import { AgencyAssignmentEngine } from './agency-assignment.engine';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService, AgencyAssignmentEngine, PrismaService],
  exports: [AssignmentService, AgencyAssignmentEngine],
})
export class AssignmentModule {}
