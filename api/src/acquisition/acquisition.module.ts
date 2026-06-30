import { Module } from '@nestjs/common';
import { AcquisitionController } from './acquisition.controller';
import { AcquisitionService } from './acquisition.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AcquisitionController],
  providers: [AcquisitionService],
})
export class AcquisitionModule {}
