import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CurrentUser, RequestUser } from '../common/current-user.decorator';
import { Roles } from '../auth/guards';

@Controller('tasks')
export class TaskController {
  constructor(private service: TaskService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTaskDto) {
    return this.service.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('agencyId') agencyId?: string,
    @Query('tag') tag?: string,
    @Query('customerName') customerName?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list(user, { status, assignedToId, agencyId, tag, customerName, from, to });
  }

  @Get('summary')
  summary(@CurrentUser() user: RequestUser) {
    return this.service.summary(user);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.delete(user, id);
  }

  // Admin: trigger AI task generation manually
  @Roles('admin')
  @Post('ai-generate')
  aiGenerate() {
    return this.service.createAiTasksForStaleAgencies();
  }
}
