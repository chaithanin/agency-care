import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({ controllers: [MasterDataController], providers: [PrismaService] })
export class MasterDataModule {}
