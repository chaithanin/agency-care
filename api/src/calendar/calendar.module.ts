import { Module } from '@nestjs/common';
import { CalendarEventService } from './calendar-event.service';
import { CalendarFilterService } from './calendar-filter.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [CalendarEventService, CalendarFilterService, PrismaService],
  exports: [CalendarEventService, CalendarFilterService],
})
export class CalendarModule {}
