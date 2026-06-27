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
  CallConfirmDto,
  CheckinDto,
  CreatePlanDto,
  FollowUpDto,
  ReportDto,
  RescheduleDto,
  UpdatePlanStatusDto,
} from './dto/visit.dto';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { TaskService } from '../task/task.service';

@Controller('visits')
export class VisitController {
  constructor(
    private service: VisitService,
    private taskService: TaskService,
  ) {}

  // ---- Plans ----
  @Roles('admin', 'closer')
  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.service.createPlan(dto);
  }

  @Roles('admin', 'closer')
  @Post('plans/bulk')
  bulkCreatePlans(@Body() dto: { agencyIds: string[]; employeeId: string; planDate: string; actionType?: string; requestDetails?: string; priority?: string; note?: string }) {
    return this.service.bulkCreate(dto);
  }

  @Get('plans')
  listPlans(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeId') employeeId?: string,
    @Query('actionType') actionType?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listPlans(user, { date, from, to, employeeId, actionType, status });
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
  async checkout(@CurrentUser() user: RequestUser, @Param('checkinId') checkinId: string) {
    const result = await this.service.checkout(user, checkinId);
    // Auto-create follow-up task asynchronously
    if (result.visitPlanId) {
      this.service.getPlanById(result.visitPlanId).then(plan => {
        if (plan) {
          this.taskService.autoCreateAfterVisit(plan.id, plan.employeeId, plan.agencyId).catch(() => {});
        }
      }).catch(() => {});
    }
    return result;
  }

  // ---- Site Visit Report Dashboard ----
  @Get('report-dashboard')
  reportDashboard(@CurrentUser() user: RequestUser, @Query('date') date?: string) {
    return this.service.reportDashboard(user, date);
  }

  // ---- Site Visit Report List ----
  @Get('report')
  getReportList(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('date') date?: string,
    @Query('employeeId') employeeId?: string,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('province') province?: string,
    @Query('agencyLevel') agencyLevel?: string,
    @Query('agencyType') agencyType?: string,
    @Query('closerId') closerId?: string,
  ) {
    return this.service.getReportList(user, { from, to, date, employeeId, agencyId, status, province, agencyLevel, agencyType, closerId });
  }

  // ---- AI Insight ----
  @Get('plans/:id/ai-insight')
  getAiInsight(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.getAiInsight(user, id);
  }

  // ---- Smart Replacement — ร้านทดแทนใกล้เคียงเมื่อ reschedule ----
  @Get('plans/:id/suggestions')
  getSuggestions(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSuggestions(user, id, limit ? Number(limit) : 10);
  }

  // ---- Call Confirm — บันทึกผลโทรยืนยันนัดหมาย ----
  @Post('plans/:id/call-confirm')
  callConfirm(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CallConfirmDto,
  ) {
    return this.service.callConfirm(user, id, dto);
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
