import { Controller, Get, Post, Patch, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { Roles } from '../auth/guards';

@Controller('deposits')
export class DepositsController {
  constructor(private svc: DepositsService) {}

  @Roles('admin', 'closer', 'sales')
  @Post('leads/:leadId')
  createDeposit(
    @Param('leadId') leadId: string,
    @Body() dto: any,
  ) {
    return this.svc.createDeposit(leadId, dto);
  }

  @Roles('admin', 'closer', 'sales')
  @Get('leads/:leadId')
  getDeposit(@Param('leadId') leadId: string) {
    return this.svc.getDeposit(leadId);
  }

  @Roles('admin', 'closer', 'sales')
  @Patch(':id')
  updateDeposit(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateDeposit(id, dto);
  }

  @Roles('admin', 'closer', 'sales')
  @Post(':depositId/transaction')
  addTransaction(
    @Param('depositId') depositId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: any,
  ) {
    return this.svc.addTransaction(depositId, user.id, dto);
  }

  @Roles('admin', 'closer')
  @Get('dashboard')
  getDashboard() {
    return this.svc.getDashboard();
  }

  @Roles('admin', 'closer', 'sales')
  @Get(':id/risk')
  getRiskAnalysis(@Param('id') id: string) {
    return this.svc.getRiskAnalysis(id);
  }
}
