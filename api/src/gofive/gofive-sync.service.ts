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
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      const customers = await this.apiClient.getCustomers(0, 1000);

      for (const customer of customers) {
        try {
          await this.prisma.goFiveCustomer.upsert({
            where: { customerId: customer.id },
            create: {
              customerId: customer.id,
              customerCode: customer.code,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              taxId: customer.taxId,
              address: customer.address,
              province: customer.province,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
            update: {
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
          });
          processed++;
        } catch (err) {
          failed++;
          this.logger.error(`Failed to sync customer ${customer.id}`, err);
        }
      }

      await this.logSync('customer', 'fetch', processed, failed, 'success', Date.now() - startTime);
      return { recordsProcessed: processed, recordsFailed: failed, status: 'success' };
    } catch (error) {
      this.logger.error('Customer sync failed', error);
      await this.logSync('customer', 'fetch', 0, 1, 'failed', Date.now() - startTime);
      return { recordsProcessed: 0, recordsFailed: 1, status: 'failed' };
    }
  }

  async syncProducts(): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      const products = await this.apiClient.getProducts(0, 1000);

      for (const product of products) {
        try {
          await this.prisma.goFiveProduct.upsert({
            where: { productId: product.id },
            create: {
              productId: product.id,
              productCode: product.code,
              name: product.name,
              price: product.price,
              stock: product.stock,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
            update: {
              name: product.name,
              price: product.price,
              stock: product.stock,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
          });
          processed++;
        } catch (err) {
          failed++;
          this.logger.error(`Failed to sync product ${product.id}`, err);
        }
      }

      await this.logSync('product', 'fetch', processed, failed, 'success', Date.now() - startTime);
      return { recordsProcessed: processed, recordsFailed: failed, status: 'success' };
    } catch (error) {
      this.logger.error('Product sync failed', error);
      await this.logSync('product', 'fetch', 0, 1, 'failed', Date.now() - startTime);
      return { recordsProcessed: 0, recordsFailed: 1, status: 'failed' };
    }
  }

  async syncOrders(customerId?: string): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      const orders = await this.apiClient.getOrders(customerId);

      for (const order of orders) {
        try {
          await this.prisma.goFiveOrder.upsert({
            where: { orderId: order.id },
            create: {
              orderId: order.id,
              orderNo: order.orderNo,
              customerId: order.customerId,
              orderDate: order.orderDate,
              status: order.status,
              total: order.total,
              items: JSON.stringify(order.items || []),
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
            update: {
              status: order.status,
              total: order.total,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
          });
          processed++;
        } catch (err) {
          failed++;
          this.logger.error(`Failed to sync order ${order.id}`, err);
        }
      }

      await this.logSync('order', 'fetch', processed, failed, 'success', Date.now() - startTime);
      return { recordsProcessed: processed, recordsFailed: failed, status: 'success' };
    } catch (error) {
      this.logger.error('Order sync failed', error);
      await this.logSync('order', 'fetch', 0, 1, 'failed', Date.now() - startTime);
      return { recordsProcessed: 0, recordsFailed: 1, status: 'failed' };
    }
  }

  async syncAppointments(startDate: string, endDate: string): Promise<SyncResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      const appointments = await this.apiClient.getAppointments(startDate, endDate);

      for (const apt of appointments) {
        try {
          await this.prisma.goFiveAppointment.upsert({
            where: { appointmentId: apt.id },
            create: {
              appointmentId: apt.id,
              customerId: apt.customerId,
              title: apt.title,
              startTime: apt.startTime,
              endTime: apt.endTime,
              status: apt.status,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
            update: {
              status: apt.status,
              lastSyncAt: new Date(),
              syncStatus: 'synced',
            },
          });
          processed++;
        } catch (err) {
          failed++;
          this.logger.error(`Failed to sync appointment ${apt.id}`, err);
        }
      }

      await this.logSync('appointment', 'fetch', processed, failed, 'success', Date.now() - startTime);
      return { recordsProcessed: processed, recordsFailed: failed, status: 'success' };
    } catch (error) {
      this.logger.error('Appointment sync failed', error);
      await this.logSync('appointment', 'fetch', 0, 1, 'failed', Date.now() - startTime);
      return { recordsProcessed: 0, recordsFailed: 1, status: 'failed' };
    }
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
