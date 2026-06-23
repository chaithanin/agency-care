import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AgencyService } from './agency.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('agencies')
export class AgencyController {
  constructor(private service: AgencyService) {}

  // อ่านได้ทุก role (เซลส์ต้องเห็น agency ที่ตัวเองดูแล)
  @Get()
  list(
    @Query('zone') zone?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({ zone, status, q });
  }

  // Phase 7: สรุป pipeline (ต้องอยู่ก่อน :id)
  @Roles('admin', 'closer')
  @Get('pipeline')
  pipeline() {
    return this.service.pipelineStats();
  }

  // ตรวจ duplicate ก่อนสร้าง (ต้องอยู่ก่อน :id)
  @Roles('admin', 'closer')
  @Get('check-duplicate')
  checkDuplicate(
    @Query('name') name?: string,
    @Query('phone') phone?: string,
    @Query('code') code?: string,
  ) {
    return this.service.checkDuplicate({ name, phone, code });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id);
  }

  // เติมพิกัดอัตโนมัติเป็นชุด (ทีละ limit ร้าน)
  @Roles('admin', 'closer')
  @Post('geocode')
  geocode(@Query('limit') limit?: string) {
    return this.service.geocodeMissing(limit ? Number(limit) : 50);
  }

  @Roles('admin', 'closer')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAgencyDto) {
    return this.service.create(dto, user.id);
  }

  @Roles('admin', 'closer')
  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    return this.service.update(id, dto, user.id);
  }
}
