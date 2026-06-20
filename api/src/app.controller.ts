import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/guards';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { ok: true, service: 'agency-care-api' };
  }
}
