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
      this.prisma.posmItem.findMany({ where: { isActive: true }, orderBy: [{ category: 'asc' }, { code: 'asc' }] }),
      this.prisma.posmTransaction.groupBy({
        by: ['posmItemId'],
        where: { createdAt: { gte: since } },
        _sum: { quantity: true },
      }),
    ]);
    const usedMap = new Map(used.map((u) => [u.posmItemId, u._sum.quantity ?? 0]));
    const rows = items.map((it) => ({
      id: it.id, code: it.code, name: it.name,
      category: it.category, description: it.description,
      unit: it.unit,
      stockQty: it.stockQty, reorderPoint: it.reorderPoint,
      used30: usedMap.get(it.id) ?? 0,
      low: it.reorderPoint > 0 && it.stockQty <= it.reorderPoint,
      urgent: it.reorderPoint > 0 && it.stockQty <= Math.floor(it.reorderPoint * 0.5),
    }));
    return {
      lowStockCount: rows.filter((r) => r.low).length,
      urgentCount: rows.filter((r) => r.urgent).length,
      items: rows,
    };
  }

  // ── Distribution Log — รายการแจกสื่อทั้งหมด ──────────────────────────────
  async distributionLog(params: { from?: string; to?: string; agencyId?: string; itemId?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) {
        const d = new Date(params.to); d.setHours(23, 59, 59);
        where.createdAt.lte = d;
      }
    }
    if (params.itemId) where.posmItemId = params.itemId;
    if (params.agencyId) where.visitPlan = { agencyId: params.agencyId };

    const include = {
      posmItem: { select: { code: true, name: true, unit: true, category: true } },
      visitPlan: {
        include: {
          agency: { select: { id: true, code: true, name: true } },
          employee: { select: { name: true, code: true } },
        },
      },
    };

    const [total, txns] = await Promise.all([
      this.prisma.posmTransaction.count({ where }),
      this.prisma.posmTransaction.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = txns.map((t) => ({
      id: t.id,
      date: t.createdAt,
      quantity: t.quantity,
      item: t.posmItem,
      agency: t.visitPlan.agency,
      employee: t.visitPlan.employee,
      visitPlanId: t.visitPlanId,
    }));

    return { data, total, page, limit };
  }

  // ── Agency Distribution Summary — สรุปต่อ Agency ──────────────────────────
  async agencySummary(params: { from?: string; to?: string; agencyId?: string }) {
    const where: any = {};
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) {
        const d = new Date(params.to); d.setHours(23, 59, 59);
        where.createdAt.lte = d;
      }
    }
    if (params.agencyId) where.visitPlan = { agencyId: params.agencyId };

    const txns = await this.prisma.posmTransaction.findMany({
      where,
      include: {
        posmItem: { select: { id: true, code: true, name: true, unit: true, category: true } },
        visitPlan: {
          include: {
            agency: { select: { id: true, code: true, name: true, zone: true } },
            employee: { select: { name: true } },
          },
        },
      },
    });

    type AgRow = {
      id: string; code: string; name: string; zone?: string | null;
      materials: Record<string, { qty: number; unit: string; category: string }>;
      total: number; lastGiven: string | null;
    };

    const agMap = new Map<string, AgRow>();
    for (const t of txns) {
      const a = t.visitPlan.agency;
      if (!agMap.has(a.id)) {
        agMap.set(a.id, { id: a.id, code: a.code, name: a.name, zone: a.zone, materials: {}, total: 0, lastGiven: null });
      }
      const row = agMap.get(a.id)!;
      const key = t.posmItem.name;
      if (!row.materials[key]) row.materials[key] = { qty: 0, unit: t.posmItem.unit, category: t.posmItem.category };
      row.materials[key].qty += t.quantity;
      row.total += t.quantity;
      const d = t.createdAt.toISOString().slice(0, 10);
      if (!row.lastGiven || d > row.lastGiven) row.lastGiven = d;
    }

    return [...agMap.values()].sort((a, b) => b.total - a.total);
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
        data: { visitPlanId: dto.visitPlanId, posmItemId: dto.posmItemId, quantity: dto.quantity },
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
