import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentController } from './appointment.controller';

@Module({ imports: [PrismaModule], controllers: [AppointmentController] })
export class AppointmentModule {}
