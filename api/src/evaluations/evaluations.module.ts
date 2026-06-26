import { Module } from '@nestjs/common';
import { EvaluationsController } from './evaluations.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [EvaluationsController], providers: [PrismaService] })
export class EvaluationsModule {}
