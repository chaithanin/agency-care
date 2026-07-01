import {
  Body, Controller, Delete, Get, Param, Patch, Post,
} from '@nestjs/common';
import { Roles } from '../auth/guards';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/current-user.decorator';
import { AssignmentPlanService } from './assignment-plan.service';
import { ApprovePlanDto, GeneratePlanDto, SaveVersionDto, SubmitPlanDto } from './assignment-plan.dto';

@Controller('assignment-plans')
@Roles('admin', 'closer')
export class AssignmentPlanController {
  constructor(private svc: AssignmentPlanService) {}

  @Post('generate')
  generate(@CurrentUser() user: RequestUser, @Body() dto: GeneratePlanDto) {
    return this.svc.generate(user, dto);
  }

  @Get()
  list() {
    return this.svc.list();
  }

  @Get(':id')
  getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.getById(user, id);
  }

  @Patch(':id/save-version')
  saveVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SaveVersionDto,
  ) {
    return this.svc.saveVersion(user, id, dto);
  }

  @Patch(':id/submit')
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SubmitPlanDto,
  ) {
    return this.svc.submit(user, id, dto);
  }

  @Patch(':id/approve')
  approve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ApprovePlanDto,
  ) {
    return this.svc.approve(user, id, dto);
  }

  @Patch(':id/publish')
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.publish(user, id);
  }

  @Post(':id/rollback/:versionId')
  rollback(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.svc.rollback(user, id, versionId);
  }

  @Delete(':id')
  delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.svc.delete(user, id);
  }
}
