import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePosmItemDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;
}

export class UpdatePosmItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  // ปรับสต็อกเป็นค่าใหม่ (เติมของเข้าคลัง)
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePosmTxnDto {
  @IsString()
  visitPlanId!: string;

  @IsString()
  posmItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
