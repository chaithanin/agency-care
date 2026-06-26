import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [TrainingController], providers: [PrismaService] })
export class TrainingModule {}
