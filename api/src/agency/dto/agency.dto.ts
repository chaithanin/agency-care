import {
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
} from 'class-validator';
import { AgencyLevel, AgencyStatus } from '@prisma/client';

export class CreateAgencyDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsEnum(AgencyLevel)
  level?: AgencyLevel;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  lineId?: string;

  @IsOptional()
  @IsString()
  tier?: string; // platinum/gold/silver/bronze/new

  @IsOptional()
  @IsString()
  pipelineStage?: string; // new/prospect/onboarding/active/grade_a/at_risk/inactive

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  gradeQuality?: string;

  @IsOptional()
  @IsString()
  gradeRelationship?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  tags?: string;
}

export class UpdateAgencyDto extends CreateAgencyDto {
  @IsOptional()
  @IsString()
  declare code: string;

  @IsOptional()
  @IsString()
  declare name: string;

  @IsOptional()
  @IsEnum(AgencyStatus)
  status?: AgencyStatus;
}
