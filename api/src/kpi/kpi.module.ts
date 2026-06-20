import { Module } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';

@Module({
  controllers: [KpiController],
  providers: [KpiService],
})
export class KpiModule {}
