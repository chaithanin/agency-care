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

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;
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
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// รับของเข้า/ปรับสต็อก (delta บวก=เติม ลบ=หัก)
export class AdjustStockDto {
  @IsInt()
  delta!: number;
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
