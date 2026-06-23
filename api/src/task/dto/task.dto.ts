import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskPriority, TaskType } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsString()
  assignedToId?: string; // default: caller's employee id

  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsOptional()
  @IsString()
  visitPlanId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(['pending', 'in_progress', 'done'])
  status?: 'pending' | 'in_progress' | 'done';

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
