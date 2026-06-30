import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarEventService {
  constructor(private prisma: PrismaService) {}

  async createEvent(data: {
    type: string;
    title: string;
    startTime: string;
    endTime: string;
    employeeId: string;
    agencyId?: string;
    description?: string;
    location?: string;
    notes?: string;
    createdById: string;
  }) {
    return this.prisma.calendarEvent.create({
      data: {
        type: data.type,
        title: data.title,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        employeeId: data.employeeId,
        agencyId: data.agencyId,
        description: data.description,
        location: data.location,
        notes: data.notes,
        createdById: data.createdById,
        status: 'scheduled',
      },
    });
  }

  async updateEvent(eventId: string, data: Partial<any>) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title: data.title || event.title,
        description: data.description || event.description,
        location: data.location || event.location,
        status: data.status || event.status,
      },
    });
  }

  async deleteEvent(eventId: string) {
    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { status: 'cancelled' },
    });
  }

  async getEventsByDateRange(employeeId: string, startDate: string, endDate: string) {
    return this.prisma.calendarEvent.findMany({
      where: {
        employeeId,
        startTime: { gte: new Date(startDate) },
        endTime: { lte: new Date(endDate) },
        status: { not: 'cancelled' },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async getEventsByEmployee(employeeId: string, skip: number = 0, take: number = 20) {
    return this.prisma.calendarEvent.findMany({
      where: { employeeId, status: { not: 'cancelled' } },
      skip,
      take,
      orderBy: { startTime: 'desc' },
    });
  }

  async getEventsByAgency(agencyId: string, skip: number = 0, take: number = 20) {
    return this.prisma.calendarEvent.findMany({
      where: { agencyId, status: { not: 'cancelled' } },
      skip,
      take,
      orderBy: { startTime: 'desc' },
    });
  }

  async rescheduleEvent(eventId: string, newStartTime: string, newEndTime: string) {
    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        startTime: new Date(newStartTime),
        endTime: new Date(newEndTime),
        status: 'rescheduled',
      },
    });
  }

  async cancelEvent(eventId: string) {
    return this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { status: 'cancelled' },
    });
  }

  async searchEvents(query: string, filters?: any) {
    return this.prisma.calendarEvent.findMany({
      where: {
        AND: [
          { OR: [{ title: { contains: query } }, { description: { contains: query } }] },
          filters?.type ? { type: filters.type } : {},
          filters?.status ? { status: filters.status } : {},
          filters?.employeeId ? { employeeId: filters.employeeId } : {},
          filters?.agencyId ? { agencyId: filters.agencyId } : {},
        ],
      },
      orderBy: { startTime: 'desc' },
    });
  }
}
