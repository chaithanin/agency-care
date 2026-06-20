import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PhotoPhase } from '@prisma/client';
import { VisitService } from './visit.service';
import {
  CheckinDto,
  CreatePlanDto,
  ReportDto,
  UpdatePlanStatusDto,
} from './dto/visit.dto';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('visits')
export class VisitController {
  constructor(private service: VisitService) {}

  // ---- Plans ----
  @Roles('admin', 'manager')
  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Get('plans')
  listPlans(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.listPlans(user, { date, from, to, employeeId });
  }

  @Get('plans/:id')
  getPlan(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.getPlan(user, id);
  }

  @Patch('plans/:id/status')
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlanStatusDto,
  ) {
    return this.service.updateStatus(user, id, dto);
  }

  // ---- Check-in ----
  @Post('plans/:id/checkin')
  checkin(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CheckinDto,
  ) {
    return this.service.checkin(user, id, dto);
  }

  // ---- Photo upload (multipart) ----
  @Post('checkins/:checkinId/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      // เก็บใน memory แล้วส่งต่อให้ StorageService (GCS หรือ local) จัดการ
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
      fileFilter: (_req, file, cb) =>
        cb(null, /^image\//.test(file.mimetype)),
    }),
  )
  addPhoto(
    @CurrentUser() user: RequestUser,
    @Param('checkinId') checkinId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('phase') phase?: string,
    @Body('latitude') latitude?: string,
    @Body('longitude') longitude?: string,
  ) {
    if (!file) throw new BadRequestException('กรุณาแนบรูปภาพ');
    const ph: PhotoPhase = (['before', 'during', 'after'].includes(phase as string)
      ? phase
      : 'during') as PhotoPhase;
    return this.service.addPhoto(user, checkinId, file, ph, {
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    });
  }

  // ---- Report ----
  @Post('plans/:id/report')
  submitReport(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReportDto,
  ) {
    return this.service.submitReport(user, id, dto);
  }
}
