import { Controller, Get, Param, Query } from '@nestjs/common'
import { KpiService } from './kpi.service'
import { Roles } from '../auth/guards'
import { CurrentUser, RequestUser } from '../common/current-user.decorator'

@Controller('kpi')
export class KpiController {
  constructor(private service: KpiService) {}

  @Get('org')
  getOrg(@Query('period') period: string) {
    const p = period ?? new Date().toISOString().slice(0, 7)
    return this.service.getOrgKpi(p)
  }

  @Get('team')
  getTeam(@Query('period') period: string, @Query('teamId') teamId?: string) {
    const p = period ?? new Date().toISOString().slice(0, 7)
    return this.service.getTeamKpi(p, teamId)
  }

  @Roles('admin', 'closer')
  @Get('closer/:id')
  getCloser(@Param('id') id: string, @Query('period') period: string) {
    const p = period ?? new Date().toISOString().slice(0, 7)
    return this.service.getCloserKpi(id, p)
  }

  @Get('employee/:id')
  getEmployee(@Param('id') id: string, @Query('period') period: string) {
    const p = period ?? new Date().toISOString().slice(0, 7)
    return this.service.getEmployeeKpi(id, p)
  }

  @Get('agency/:id')
  getAgency(@Param('id') id: string) {
    return this.service.getAgencyKpi(id)
  }

  @Get('me')
  getMe(@CurrentUser() user: RequestUser, @Query('period') period: string) {
    const p = period ?? new Date().toISOString().slice(0, 7)
    return this.service.getEmployeeKpi(user.employeeId ?? '', p)
  }
}
