import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarFilterService {
  constructor(private prisma: PrismaService) {}

  async createFilter(userId: string, name: string, filterType: string, filterValue: string[]) {
    return this.prisma.calendarFilter.create({
      data: {
        name,
        userId,
        filterType,
        filterValue: JSON.stringify(filterValue),
      },
    });
  }

  async getFiltersByUser(userId: string) {
    return this.prisma.calendarFilter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFilter(filterId: string) {
    const filter = await this.prisma.calendarFilter.findUnique({
      where: { id: filterId },
    });
    if (!filter) throw new NotFoundException('Filter not found');
    return filter;
  }

  async updateFilter(filterId: string, name?: string, filterValue?: string[]) {
    return this.prisma.calendarFilter.update({
      where: { id: filterId },
      data: {
        name,
        filterValue: filterValue ? JSON.stringify(filterValue) : undefined,
      },
    });
  }

  async deleteFilter(filterId: string) {
    return this.prisma.calendarFilter.delete({
      where: { id: filterId },
    });
  }

  async setDefaultFilter(userId: string, filterId: string) {
    await this.prisma.calendarFilter.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return this.prisma.calendarFilter.update({
      where: { id: filterId },
      data: { isDefault: true },
    });
  }

  async applyFilter(userId: string, filterType: string, filterValue: string[]) {
    const filters = {
      employee: { employeeId: { in: filterValue } },
      role: { employee: { position: { in: filterValue } } },
      activity: { type: { in: filterValue } },
      status: { status: { in: filterValue } },
      agency: { agencyId: { in: filterValue } },
    };

    const whereClause = (filters as any)[filterType] || {};

    return this.prisma.calendarEvent.findMany({
      where: { ...whereClause, status: { not: 'cancelled' } },
      orderBy: { startTime: 'desc' },
      take: 100,
    });
  }
}
