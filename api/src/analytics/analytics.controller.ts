import { Controller, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../auth/guards';

@Roles('admin', 'manager')
@Controller('analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  // POST เพราะเรียกใช้ LLM (มีต้นทุน) — ไม่ cache แบบ GET
  @Post('insights')
  insights() {
    return this.service.analyze();
  }
}
