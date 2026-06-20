import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ModelStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';
import { assertVisitAccess } from '../common/visit-ownership';

export class CreateModelDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class MoveModelDto {
  @IsString()
  modelId!: string;

  // ปลายทาง (deploy) — ไม่ต้องใส่ตอน return
  @IsOptional()
  @IsString()
  agencyId?: string;

  @IsOptional()
  @IsString()
  visitPlanId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateModelStatusDto {
  @IsEnum(ModelStatus)
  status!: ModelStatus;
}

@Injectable()
export class ModelService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.model.findMany({
      orderBy: { code: 'asc' },
      include: { currentAgency: { select: { code: true, name: true } } },
    });
  }

  async create(dto: CreateModelDto) {
    const dup = await this.prisma.model.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`รหัส ${dto.code} ถูกใช้แล้ว`);
    return this.prisma.model.create({ data: dto });
  }

  // ส่งอุปกรณ์ไปติดตั้งที่ร้าน
  async deploy(user: RequestUser, dto: MoveModelDto) {
    if (!dto.agencyId) throw new BadRequestException('ต้องระบุร้านปลายทาง');
    if (dto.visitPlanId) await assertVisitAccess(this.prisma, user, dto.visitPlanId);
    const model = await this.prisma.model.findUnique({ where: { id: dto.modelId } });
    if (!model) throw new NotFoundException('ไม่พบอุปกรณ์');

    await this.prisma.modelTransaction.create({
      data: {
        modelId: dto.modelId,
        agencyId: dto.agencyId,
        visitPlanId: dto.visitPlanId,
        action: 'deploy',
        note: dto.note,
      },
    });
    return this.prisma.model.update({
      where: { id: dto.modelId },
      data: { currentAgencyId: dto.agencyId, status: 'deployed' },
      include: { currentAgency: { select: { code: true, name: true } } },
    });
  }

  // รับอุปกรณ์กลับคลัง
  async returnToStock(user: RequestUser, dto: MoveModelDto) {
    if (dto.visitPlanId) await assertVisitAccess(this.prisma, user, dto.visitPlanId);
    const model = await this.prisma.model.findUnique({ where: { id: dto.modelId } });
    if (!model) throw new NotFoundException('ไม่พบอุปกรณ์');

    await this.prisma.modelTransaction.create({
      data: {
        modelId: dto.modelId,
        agencyId: model.currentAgencyId,
        visitPlanId: dto.visitPlanId,
        action: 'return',
        note: dto.note,
      },
    });
    return this.prisma.model.update({
      where: { id: dto.modelId },
      data: { currentAgencyId: null, status: 'in_stock' },
    });
  }

  async setStatus(id: string, dto: UpdateModelStatusDto) {
    const model = await this.prisma.model.findUnique({ where: { id } });
    if (!model) throw new NotFoundException('ไม่พบอุปกรณ์');
    return this.prisma.model.update({ where: { id }, data: { status: dto.status } });
  }
}
