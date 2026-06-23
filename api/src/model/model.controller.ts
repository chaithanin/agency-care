import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ModelService,
  CreateModelDto,
  MoveModelDto,
  UpdateModelStatusDto,
  UpdateModelDto,
} from './model.service';
import { Roles } from '../auth/guards';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';

@Controller('models')
export class ModelController {
  constructor(private service: ModelService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Roles('admin', 'closer')
  @Post()
  create(@Body() dto: CreateModelDto) {
    return this.service.create(dto);
  }

  // เซลส์ติดตั้ง/รับคืนได้ตอนเข้าเยี่ยม
  @Post('deploy')
  deploy(@CurrentUser() user: RequestUser, @Body() dto: MoveModelDto) {
    return this.service.deploy(user, dto);
  }

  @Post('return')
  returnToStock(@CurrentUser() user: RequestUser, @Body() dto: MoveModelDto) {
    return this.service.returnToStock(user, dto);
  }

  @Roles('admin', 'closer')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateModelDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin', 'closer')
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: UpdateModelStatusDto) {
    return this.service.setStatus(id, dto);
  }
}
