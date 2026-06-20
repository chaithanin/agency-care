import { Controller, Get, Query } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { Roles } from '../auth/guards';

@Roles('admin', 'manager')
@Controller('kpi')
export class KpiController {
  constructor(private service: KpiService) {}

  @Get()
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.summary(from, to);
  }
}
