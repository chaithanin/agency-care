import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiForecastController } from './ai-forecast.controller';

@Module({ imports: [PrismaModule], controllers: [AiForecastController] })
export class AiForecastModule {}
