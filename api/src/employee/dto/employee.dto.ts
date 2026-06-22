import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EmployeePosition } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  lineUserId?: string;

  // ถ้าใส่ email+password จะสร้างบัญชี login (role=sales) ให้ด้วย
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  lineUserId?: string;

  @IsOptional()
  @IsEnum(EmployeePosition)
  position?: EmployeePosition;

  @IsOptional()
  @IsString()
  teamId?: string | null;

  @IsOptional()
  @IsBoolean()
  inTraining?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
