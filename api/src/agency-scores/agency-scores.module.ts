import { Module } from '@nestjs/common';
import { AgencyScoresController } from './agency-scores.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [AgencyScoresController], providers: [PrismaService] })
export class AgencyScoresModule {}
