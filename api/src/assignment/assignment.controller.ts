import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AssignmentService } from './assignment.service';
import { Roles } from '../auth/guards';

class AssignDto {
  @IsString()
  agencyId!: string;

  @IsString()
  employeeId!: string;
}

@Roles('admin', 'manager')
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
}
