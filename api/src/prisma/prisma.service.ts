import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildUrl() {
  const url = process.env.DATABASE_URL ?? '';
  // Neon free tier caps connections at ~5; Cloud Run can have multiple instances.
  // Append connection_limit=2 so each instance stays within budget.
  const sep = url.includes('?') ? '&' : '?';
  return url.includes('connection_limit') ? url : `${url}${sep}connection_limit=2`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasources: { db: { url: buildUrl() } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
