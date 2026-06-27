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

  @Get('history')
  history(@Query('limit') limit?: string) {
    return this.service.history(limit ? parseInt(limit, 10) : 100);
  }

  @Roles('admin')
  @Post('yearly-plans')
  generateYearlyPlans(@Body() body: { year?: number }) {
    const year = body.year ?? new Date().getUTCFullYear() + 1;
    return this.service.generateYearlyPlans(year);
  }
}
