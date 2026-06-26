import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiHealthController } from './ai-health.controller';

@Module({ imports: [PrismaModule], controllers: [AiHealthController] })
export class AiHealthModule {}
