import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateProductDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({ orderBy: { code: 'asc' } });
  }

  async create(dto: CreateProductDto) {
    const dup = await this.prisma.product.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`รหัส ${dto.code} ถูกใช้แล้ว`);
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, dto: UpdateProductDto) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('ไม่พบสินค้า');
    return this.prisma.product.update({ where: { id }, data: dto });
  }
}
