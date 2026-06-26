import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [ApprovalsController], providers: [PrismaService] })
export class ApprovalsModule {}
