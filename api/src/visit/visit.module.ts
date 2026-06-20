import { Module } from '@nestjs/common';
import { VisitService } from './visit.service';
import { VisitController } from './visit.controller';

@Module({
  controllers: [VisitController],
  providers: [VisitService],
})
export class VisitModule {}
