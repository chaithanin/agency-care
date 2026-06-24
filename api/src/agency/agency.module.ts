import { Module } from '@nestjs/common';
import { AgencyService } from './agency.service';
import { AgencyController } from './agency.controller';
import { AgencyScoreService } from './agency-score.service';

@Module({
  controllers: [AgencyController],
  providers: [AgencyService, AgencyScoreService],
  exports: [AgencyService, AgencyScoreService],
})
export class AgencyModule {}
