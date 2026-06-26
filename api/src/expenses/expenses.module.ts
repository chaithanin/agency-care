import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [ExpensesController], providers: [PrismaService] })
export class ExpensesModule {}
