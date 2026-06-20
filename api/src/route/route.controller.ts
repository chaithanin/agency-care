import { Controller, Get, Query } from '@nestjs/common';
import { RouteService } from './route.service';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('route')
export class RouteController {
  constructor(private service: RouteService) {}

  @Get()
  plan(
    @CurrentUser() user: RequestUser,
    @Query('date') date: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.planRoute(user, { date, employeeId });
  }
}
