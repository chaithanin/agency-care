import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiRiskController } from './ai-risk.controller';

@Module({ imports: [PrismaModule], controllers: [AiRiskController] })
export class AiRiskModule {}
