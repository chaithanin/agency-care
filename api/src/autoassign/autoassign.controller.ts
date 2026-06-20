import { Body, Controller, Get, Post } from '@nestjs/common';
import { AutoAssignService, ApplyAssignmentDto } from './autoassign.service';
import { Roles } from '../auth/guards';

@Roles('admin', 'manager')
@Controller('auto-assign')
export class AutoAssignController {
  constructor(private service: AutoAssignService) {}

  @Get('propose')
  propose() {
    return this.service.propose();
  }

  @Post('apply')
  apply(@Body() dto: ApplyAssignmentDto) {
    return this.service.apply(dto);
  }
}
