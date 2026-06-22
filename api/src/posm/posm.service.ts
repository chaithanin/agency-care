import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';
import { assertVisitAccess } from '../common/visit-ownership';
import { CreatePosmItemDto, CreatePosmTxnDto, UpdatePosmItemDto } from './dto/posm.dto';

@Injectable()
export class PosmService {
  constructor(private prisma: PrismaService) {}

  // ---- master items ----
  listItems() {
    return this.prisma.posmItem.findMany({ orderBy: { code: 'asc' } });
  }

  async createItem(dto: CreatePosmItemDto) {
    const dup = await this.prisma.posmItem.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`รหัส ${dto.code} ถูกใช้แล้ว`);
    return this.prisma.posmItem.create({ data: dto });
  }

  async updateItem(id: string, dto: UpdatePosmItemDto) {
    const item = await this.prisma.posmItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('ไม่พบรายการสื่อ');
    return this.prisma.posmItem.update({ where: { id }, data: dto });
  }

  // รับของเข้า/ปรับสต็อก (delta บวก=เติม) — atomic, กันติดลบ
  async adjustStock(id: string, delta: number) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.posmItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('ไม่พบรายการสื่อ');
      const next = item.stockQty + delta;
      if (next < 0) throw new BadRequestException(`สต็อกไม่พอ (เหลือ ${item.stockQty})`);
      return tx.posmItem.update({ where: { id }, data: { stockQty: next } });
    });
  }

  // Phase 7: คลังสื่อ — สต็อก + จุดสั่งซื้อ + การใช้ 30 วัน + แจ้งเตือนสต็อกต่ำ
  async inventory() {
    const since = new Date(Date.now() - 30 * 86400000);
    const [items, used] = await Promise.all([
      this.prisma.posmItem.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
      this.prisma.posmTransaction.groupBy({
        by: ['posmItemId'],
        where: { createdAt: { gte: since } },
        _sum: { quantity: true },
      }),
    ]);
    const usedMap = new Map(used.map((u) => [u.posmItemId, u._sum.quantity ?? 0]));
    const rows = items.map((it) => ({
      id: it.id, code: it.code, name: it.name, unit: it.unit,
      stockQty: it.stockQty, reorderPoint: it.reorderPoint,
      used30: usedMap.get(it.id) ?? 0,
      low: it.reorderPoint > 0 && it.stockQty <= it.reorderPoint,
    }));
    return { lowStockCount: rows.filter((r) => r.low).length, items: rows };
  }

  // ---- แจกสื่อในงานเยี่ยม (ตัดสต็อกแบบ atomic) ----
  async giveOut(user: RequestUser, dto: CreatePosmTxnDto) {
    await assertVisitAccess(this.prisma, user, dto.visitPlanId);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.posmItem.findUnique({ where: { id: dto.posmItemId } });
      if (!item) throw new NotFoundException('ไม่พบรายการสื่อ');
      if (item.stockQty < dto.quantity) {
        throw new BadRequestException(
          `สต็อก ${item.name} เหลือ ${item.stockQty} ${item.unit} (ขอ ${dto.quantity})`,
        );
      }
      await tx.posmItem.update({
        where: { id: item.id },
        data: { stockQty: { decrement: dto.quantity } },
      });
      return tx.posmTransaction.create({
        data: {
          visitPlanId: dto.visitPlanId,
          posmItemId: dto.posmItemId,
          quantity: dto.quantity,
        },
        include: { posmItem: { select: { code: true, name: true, unit: true } } },
      });
    });
  }

  listByVisit(visitPlanId: string) {
    return this.prisma.posmTransaction.findMany({
      where: { visitPlanId },
      orderBy: { createdAt: 'asc' },
      include: { posmItem: { select: { code: true, name: true, unit: true } } },
    });
  }
}
