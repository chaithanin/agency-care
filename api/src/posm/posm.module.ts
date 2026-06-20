import { Module } from '@nestjs/common';
import { PosmService } from './posm.service';
import { PosmController } from './posm.controller';

@Module({
  controllers: [PosmController],
  providers: [PosmService],
})
export class PosmModule {}
