import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { VisitStatus } from '@prisma/client';

export class CreatePlanDto {
  @IsString()
  agencyId!: string;

  @IsString()
  employeeId!: string;

  @IsDateString()
  planDate!: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePlanStatusDto {
  @IsEnum(VisitStatus)
  status!: VisitStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CheckinDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number; // ความแม่นยำ GPS (เมตร)

  @IsOptional()
  @IsBoolean()
  isMock?: boolean; // client แจ้งว่าตรวจพบ mock location

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPosition?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class RescheduleDto {
  @IsString()
  reason!: string; // เหตุผลที่เลื่อน

  @IsOptional()
  @IsDateString()
  newDate?: string; // วันใหม่ (ถ้าไม่ใส่ = เลื่อนแบบ postponed)
}

export class FollowUpDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class ReportDto {
  @IsArray()
  @IsString({ each: true })
  purposes!: string[];

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  problems?: string;

  @IsOptional()
  @IsString()
  actionPlan?: string;
}
