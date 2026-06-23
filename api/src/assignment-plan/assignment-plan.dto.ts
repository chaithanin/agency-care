import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratePlanDto {
  @IsString()
  period!: string; // "2026-07"

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerSales?: number;
}

class PlanItemDto {
  @IsString()
  agencyId!: string;

  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  isLocked?: boolean;
}

export class SaveVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items!: PlanItemDto[];

  @IsOptional()
  @IsString()
  note?: string; // เหตุผลที่แก้ไข
}

export class SubmitPlanDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ApprovePlanDto {
  @IsOptional()
  @IsString()
  note?: string;
}
