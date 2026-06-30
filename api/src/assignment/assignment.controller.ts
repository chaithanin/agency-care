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
}
