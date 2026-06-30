import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { AcquisitionService } from './acquisition.service';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('acquisition')
export class AcquisitionController {
  constructor(private svc: AcquisitionService) {}

  @Get('leads')
  list(@Query() q: any) { return this.svc.list(q); }

  @Get('leads/dashboard')
  dashboard() { return this.svc.dashboard(); }

  @Get('leads/employees')
  employees() { return this.svc.employees(); }

  @Post('leads')
  create(@CurrentUser() u: RequestUser, @Body() dto: any) {
    return this.svc.create(u.id, dto);
  }

  @Get('leads/:id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Patch('leads/:id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Post('leads/:id/assign')
  assign(@Param('id') id: string, @Body() dto: { employeeId: string }) {
    return this.svc.assign(id, dto.employeeId);
  }

  @Patch('leads/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: { newStatus: string }) {
    return this.svc.updateLeadStatus(id, dto.newStatus);
  }

  @Post('leads/:id/qualify')
  qualify(@Param('id') id: string, @Body() dto: any) { return this.svc.saveQualification(id, dto); }

  @Post('leads/:id/contacts')
  addContact(@Param('id') id: string, @Body() dto: any) { return this.svc.addContact(id, dto); }

  @Post('leads/:id/appointments')
  addAppointment(@Param('id') id: string, @Body() dto: any) { return this.svc.addAppointment(id, dto); }

  @Post('leads/:id/site-visits')
  addSiteVisit(@Param('id') id: string, @Body() dto: any) { return this.svc.addSiteVisit(id, dto); }

  @Patch('leads/:id/evaluation')
  saveEvaluation(@Param('id') id: string, @Body() dto: any) { return this.svc.saveEvaluation(id, dto); }

  @Patch('leads/:id/approval')
  saveApproval(@Param('id') id: string, @CurrentUser() u: RequestUser, @Body() dto: any) {
    return this.svc.saveApproval(id, u.id, dto);
  }

  @Patch('leads/:id/agreement')
  saveAgreement(@Param('id') id: string, @Body() dto: any) { return this.svc.saveAgreement(id, dto); }

  @Patch('leads/:id/onboarding')
  saveOnboarding(@Param('id') id: string, @Body() dto: any) { return this.svc.saveOnboarding(id, dto); }

  @Patch('leads/:id/training')
  saveTraining(@Param('id') id: string, @Body() dto: any) { return this.svc.saveTraining(id, dto); }

  @Post('leads/:id/marketing')
  addMarketing(@Param('id') id: string, @Body() dto: any) { return this.svc.addMarketingItem(id, dto); }

  @Post('leads/:id/first-sale')
  firstSale(@Param('id') id: string, @Body() dto: any) { return this.svc.recordFirstSale(id, dto); }
}
