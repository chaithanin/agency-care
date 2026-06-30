import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AssignmentService } from './assignment.service';
import { Roles } from '../auth/guards';

class AssignDto {
  @IsString()
  agencyId!: string;

  @IsString()
  employeeId!: string;
}

@Roles('admin', 'closer')
@Controller('assignments')
export class AssignmentController {
  constructor(private service: AssignmentService) {}

  @Post()
  assign(@Body() dto: AssignDto) {
    return this.service.assign(dto.agencyId, dto.employeeId);
  }

  @Delete()
  unassign(@Body() dto: AssignDto) {
    return this.service.unassign(dto.agencyId, dto.employeeId);
  }

  @Get('employee/:employeeId')
  byEmployee(@Param('employeeId') employeeId: string) {
    return this.service.byEmployee(employeeId);
  }

  // Agency Assignment Engine Endpoints

  @Roles('admin', 'closer', 'sales')
  @Get('agencies/scored')
  getAgenciesByScore(
    @Query('employeeId') employeeId: string,
    @Query('date') date: string,
    @Query('zone') zone?: string,
  ) {
    return this.service.getAgenciesByScore(employeeId, date, zone);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('optimal-assignments')
  getOptimalAssignments(
    @Query('employeeId') employeeId: string,
    @Query('date') date: string,
    @Query('count') count: number = 3,
  ) {
    return this.service.getOptimalAssignments(employeeId, date, count);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('backup-agencies')
  getBackupAgencies(
    @Query('employeeId') employeeId: string,
    @Query('date') date: string,
    @Query('zone') zone?: string,
    @Query('excludeIds') excludeIds?: string,
  ) {
    const ids = excludeIds ? excludeIds.split(',') : [];
    return this.service.getBackupAgencies(employeeId, date, zone, ids);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('check-consecutive')
  checkConsecutive(
    @Query('employeeId') employeeId: string,
    @Query('agencyId') agencyId: string,
    @Query('date') date: string,
  ) {
    return this.service.checkConsecutiveAssignments(
      employeeId,
      agencyId,
      date,
    );
  }

  // Auto-Reschedule Endpoints

  @Roles('admin', 'closer')
  @Post('reschedule/cancel/:planId')
  handleCancellation(@Param('planId') planId: string) {
    return this.service.handleCancellation(planId);
  }

  @Roles('admin', 'closer')
  @Post('reschedule/move/:planId')
  handleReschedule(
    @Param('planId') planId: string,
    @Body('newDate') newDate: string,
  ) {
    return this.service.handleReschedule(planId, newDate);
  }

  @Roles('admin', 'closer')
  @Post('reschedule/sick-leave/:employeeId')
  handleSickLeave(
    @Param('employeeId') employeeId: string,
    @Body('date') date: string,
  ) {
    return this.service.handleSickLeave(employeeId, date);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('reschedule/pending')
  getPendingReschedules() {
    return this.service.getPendingReschedules();
  }

  @Roles('admin', 'closer')
  @Get('reschedule/stats')
  getRescheduleStats(@Query('month') month: string) {
    return this.service.getRescheduleStats(month);
  }
}
