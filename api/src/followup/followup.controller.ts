import { Controller, Get, Param, Patch } from '@nestjs/common';
import { FollowupService } from './followup.service';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('followups')
export class FollowupController {
  constructor(private service: FollowupService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.service.list(user);
  }

  @Patch(':id/done')
  markDone(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.markDone(user, id);
  }
}
