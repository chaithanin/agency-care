import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoFiveApiClient } from './gofive-api.client';

interface SyncResult {
  recordsProcessed: number;
  recordsFailed: number;
  status: 'success' | 'partial' | 'failed';
}

@Injectable()
export class GoFiveSyncService {
  private readonly logger = new Logger(GoFiveSyncService.name);

  constructor(
    private prisma: PrismaService,
    private apiClient: GoFiveApiClient,
  ) {}

  async syncCustomers(): Promise<SyncResult> {
    return { recordsProcessed: 0, recordsFailed: 0, status: 'success' };
  }

  async syncProducts(): Promise<SyncResult> {
    return { recordsProcessed: 0, recordsFailed: 0, status: 'success' };
  }

  async syncOrders(customerId?: string): Promise<SyncResult> {
    return { recordsProcessed: 0, recordsFailed: 0, status: 'success' };
  }

  async syncAppointments(startDate: string, endDate: string): Promise<SyncResult> {
    return { recordsProcessed: 0, recordsFailed: 0, status: 'success' };
  }

  private async logSync(
    entityType: string,
    action: string,
    processed: number,
    failed: number,
    status: string,
    duration: number,
  ) {
    await this.prisma.goFiveSyncLog.create({
      data: {
        entityType,
        action,
        recordsProcessed: processed,
        recordsFailed: failed,
        status,
        duration,
      },
    });
  }
}
