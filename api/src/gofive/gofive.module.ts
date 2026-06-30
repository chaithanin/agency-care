import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GoFiveAuthService } from './oauth2-gofive.service';
import { GoFiveApiClient } from './gofive-api.client';
import { GoFiveSyncService } from './gofive-sync.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [HttpModule],
  providers: [GoFiveAuthService, GoFiveApiClient, GoFiveSyncService, PrismaService],
  exports: [GoFiveAuthService, GoFiveApiClient, GoFiveSyncService],
})
export class GoFiveModule {}
