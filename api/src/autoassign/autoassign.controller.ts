import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AutoAssignService, ApplyAssignmentDto } from './autoassign.service';
import { Roles } from '../auth/guards';

@Roles('admin', 'closer')
@Controller('auto-assign')
export class AutoAssignController {
  constructor(private service: AutoAssignService) {}

  @Get('propose')
  propose(@Query('maxPerSales') maxPerSales?: string) {
    return this.service.propose(maxPerSales ? parseInt(maxPerSales, 10) : undefined);
  }

  @Post('apply')
  apply(@Body() dto: ApplyAssignmentDto) {
    return this.service.apply(dto);
  }
}
