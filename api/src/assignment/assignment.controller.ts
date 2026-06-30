import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { AssignmentService } from './assignment.service';
import { Roles, User } from '../auth/guards';

interface UserPayload {
  sub: string;
  name: string;
  role: string;
}

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

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Assignment Planning Endpoints
  // ═══════════════════════════════════════════════════════════════

  @Roles('admin', 'closer')
  @Post('plans/draft')
  createDraft(
    @Body('employeeId') employeeId: string,
    @Body('month') month: string, // YYYY-MM
  ) {
    return this.service.createPlanDraft(employeeId, month);
  }

  @Roles('admin', 'closer')
  @Get('plans/:planId')
  getPlan(@Param('planId') planId: string) {
    return this.service.getPlan(planId);
  }

  @Roles('admin', 'closer')
  @Put('plans/:planId')
  updatePlan(
    @Param('planId') planId: string,
    @Body('notes') notes?: string,
  ) {
    return this.service.updatePlan(planId, { notes });
  }

  @Roles('closer')
  @Post('plans/:planId/submit')
  submitForApproval(
    @Param('planId') planId: string,
    @User() user: UserPayload,
  ) {
    return this.service.submitForApproval(planId, user.sub);
  }

  @Roles('admin')
  @Post('plans/:planId/approve')
  approvePlan(
    @Param('planId') planId: string,
    @Body('notes') notes: string,
    @User() user: UserPayload,
  ) {
    return this.service.approvePlan(planId, user.sub, notes);
  }

  @Roles('admin')
  @Post('plans/:planId/publish')
  publishPlan(@Param('planId') planId: string) {
    return this.service.publishPlan(planId);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('quota')
  getQuotaStatus(
    @Query('employeeId') employeeId: string,
    @Query('month') month: string,
  ) {
    return this.service.getQuotaStatus(employeeId, month);
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Agency Assignment Engine Endpoints
  // ═══════════════════════════════════════════════════════════════

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
}
