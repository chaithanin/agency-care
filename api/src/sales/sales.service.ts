import { Injectable, NotFoundException } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';
import { assertVisitAccess } from '../common/visit-ownership';

export class CreateSalesDto {
  @IsString()
  visitPlanId!: string;

  @IsString()
  productId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyOffered?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtySold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async record(user: RequestUser, dto: CreateSalesDto) {
    await assertVisitAccess(this.prisma, user, dto.visitPlanId);
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');

    // ถ้าไม่กรอกยอด ใช้ qtySold * ราคาสินค้า
    const amount =
      dto.amount != null ? dto.amount : (dto.qtySold ?? 0) * product.price;

    return this.prisma.salesActivity.create({
      data: {
        visitPlanId: dto.visitPlanId,
        productId: dto.productId,
        qtyOffered: dto.qtyOffered ?? 0,
        qtySold: dto.qtySold ?? 0,
        amount,
      },
      include: { product: { select: { code: true, name: true } } },
    });
  }

  listByVisit(visitPlanId: string) {
    return this.prisma.salesActivity.findMany({
      where: { visitPlanId },
      orderBy: { createdAt: 'asc' },
      include: { product: { select: { code: true, name: true } } },
    });
  }
}
