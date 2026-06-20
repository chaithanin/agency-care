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
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
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
