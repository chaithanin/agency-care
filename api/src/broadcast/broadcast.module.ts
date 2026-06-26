import { Module } from '@nestjs/common';
import { BroadcastController } from './broadcast.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BroadcastController],
})
export class BroadcastModule {}
