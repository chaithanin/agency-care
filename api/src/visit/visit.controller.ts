import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
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
  FollowUpDto,
  ReportDto,
  RescheduleDto,
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
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.service.checkin(user, id, dto, { ip, userAgent: ua });
  }

  // ---- เลื่อนการเข้าพบ (พร้อมเหตุผล) ----
  @Post('plans/:id/reschedule')
  reschedule(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.service.reschedule(user, id, dto);
  }

  // ---- อัปโหลดรูปการทำงาน (ไม่ต้อง check-in) ----
  @Post('plans/:id/work-photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
    }),
  )
  addWorkPhoto(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
    @Body('latitude') latitude?: string,
    @Body('longitude') longitude?: string,
  ) {
    if (!file) throw new BadRequestException('กรุณาแนบรูปภาพ');
    return this.service.addWorkPhoto(user, id, file, caption, {
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    });
  }

  // ---- Check-out ----
  @Post('checkins/:checkinId/checkout')
  checkout(@CurrentUser() user: RequestUser, @Param('checkinId') checkinId: string) {
    return this.service.checkout(user, checkinId);
  }

  // ---- ผู้เข้าพบ ----
  @Patch('checkins/:checkinId/contact')
  setContact(
    @CurrentUser() user: RequestUser,
    @Param('checkinId') checkinId: string,
    @Body() dto: { contactName?: string; contactPosition?: string; contactPhone?: string },
  ) {
    return this.service.setContact(user, checkinId, dto);
  }

  // ---- Follow-up tasks ----
  @Post('plans/:id/followups')
  createFollowUp(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: FollowUpDto,
  ) {
    return this.service.createFollowUp(user, id, dto);
  }

  @Get('plans/:id/followups')
  listFollowUps(@Param('id') id: string) {
    return this.service.listFollowUps(id);
  }

  @Patch('followups/:taskId/toggle')
  toggleFollowUp(@CurrentUser() user: RequestUser, @Param('taskId') taskId: string) {
    return this.service.toggleFollowUp(user, taskId);
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
    const valid = ['before', 'during', 'after', 'office', 'activity', 'material', 'selfie'];
    const ph: PhotoPhase = (valid.includes(phase as string) ? phase : 'during') as PhotoPhase;
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
