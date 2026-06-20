import { Module } from '@nestjs/common';
import { AutoAssignService } from './autoassign.service';
import { AutoAssignController } from './autoassign.controller';

@Module({
  controllers: [AutoAssignController],
  providers: [AutoAssignService],
})
export class AutoAssignModule {}
