import {
  IsArray,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
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
