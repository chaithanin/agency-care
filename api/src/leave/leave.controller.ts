import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('leave')
export class LeaveController {
  constructor(private service: LeaveService) {}

  // พนักงานส่งใบลา (employee เท่านั้น — ต้องมี employee profile)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: any) {
    const employeeId = user.employeeId;
    if (!employeeId) throw new Error('No employee profile linked to this account');
    return this.service.create(employeeId, body);
  }

  // ดูรายการใบลา — manager เห็นทั้งหมด, sales เห็นของตัวเอง
  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    const isManager = ['admin', 'super_admin', 'closer'].includes(user.activeRole);
    return this.service.list({
      employeeId: isManager ? employeeId : user.employeeId,
      status,
      month,
    });
  }

  // สรุปการลาของเดือน (approved only)
  @Roles('admin', 'super_admin', 'closer')
  @Get('summary')
  summary(@Query('month') month: string) {
    return this.service.summary(month || new Date().toISOString().slice(0, 7));
  }

  // อนุมัติ
  @Roles('admin', 'super_admin', 'closer')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.approve(id, user.id);
  }

  // ปฏิเสธ
  @Roles('admin', 'super_admin', 'closer')
  @Patch(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() body: { reason?: string }) {
    return this.service.reject(id, user.id, body.reason);
  }

  // ยกเลิก (เฉพาะเจ้าของใบลา)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.service.cancel(id, user.employeeId ?? '');
  }
}
