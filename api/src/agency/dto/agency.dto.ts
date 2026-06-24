import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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
  profileData?: Record<string, unknown>;

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

  // Agreement
  @IsOptional()
  @IsBoolean()
  agreementActive?: boolean;

  @IsOptional()
  @IsDateString()
  agreementStartDate?: string;

  @IsOptional()
  @IsDateString()
  agreementExpiry?: string;

  // Sales performance
  @IsOptional()
  @IsBoolean()
  sellsOurProjects?: boolean;

  @IsOptional()
  @IsDateString()
  lastSaleDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastUnitsSold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalUnitsSold?: number;

  // Office & team
  @IsOptional()
  @IsBoolean()
  physicalOffice?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  numSalesAgents?: number;

  // Marketing
  @IsOptional()
  @IsBoolean()
  advertisesOurProjects?: boolean;

  @IsOptional()
  @IsBoolean()
  paidAds?: boolean;

  // Social media
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  otherSocial?: string;

  // Specialisation
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mainProjects?: string[];

  // Visit cadence
  @IsOptional()
  @IsNumber()
  @Min(0)
  visitFrequency?: number;

  // Assignment & workflow
  @IsOptional()
  @IsString()
  assignedCloserId?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: string;
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

  @IsOptional()
  @IsString()
  agencyScore?: string;
}
