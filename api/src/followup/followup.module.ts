import { Module } from '@nestjs/common';
import { FollowupService } from './followup.service';
import { FollowupController } from './followup.controller';

@Module({
  controllers: [FollowupController],
  providers: [FollowupService],
})
export class FollowupModule {}
