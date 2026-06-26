import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PrStatus =
  | 'draft' | 'submitted' | 'waiting_approval' | 'approved'
  | 'purchasing' | 'ordered' | 'received' | 'completed' | 'cancelled';

export type PrPriority = 'low' | 'medium' | 'high' | 'urgent';

const OPEN_STATUSES: PrStatus[] = ['submitted', 'waiting_approval', 'approved', 'purchasing', 'ordered', 'received'];
const CLOSED_STATUSES: PrStatus[] = ['completed', 'cancelled'];

export interface CreatePrDto {
  department: string;
  prType: string;
  priority?: PrPriority;
  title: string;
  description?: string;
  note?: string;
  budgetTotal?: number;
  dueDate?: string;
  responsibleId?: string;
  approverId?: string;
  items?: { name: string; detail?: string; qty: number; unit?: string; budget?: number; neededBy?: string }[];
  checklistLabels?: string[];
}

export interface UpdatePrDto {
  department?: string;
  prType?: string;
  priority?: PrPriority;
  title?: string;
  description?: string;
  note?: string;
  budgetTotal?: number;
  dueDate?: string;
  responsibleId?: string;
  approverId?: string;
}

@Injectable()
export class PrService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // PR Number generation
  // ============================================================

  private async nextPrNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.$transaction(async (tx) => {
      const current = await tx.prSequence.findUnique({ where: { id: 'singleton' } });
      const lastSeq = current?.year === year ? (current?.lastSeq ?? 0) : 0;
      const nextSeq = lastSeq + 1;
      await tx.prSequence.upsert({
        where: { id: 'singleton' },
        update: { lastSeq: nextSeq, year },
        create: { id: 'singleton', lastSeq: nextSeq, year },
      });
      return nextSeq;
    });
    return `PR-${year}-${String(seq).padStart(5, '0')}`;
  }

  // ============================================================
  // CRUD
  // ============================================================

  async create(userId: string, dto: CreatePrDto) {
    const prNumber = await this.nextPrNumber();
    const DEFAULT_CHECKLISTS = [
      'ขอใบเสนอราคา', 'รออนุมัติ', 'สั่งซื้อ', 'รับสินค้า', 'ตรวจสอบเอกสาร',
    ];
    const checklistLabels = dto.checklistLabels?.length ? dto.checklistLabels : DEFAULT_CHECKLISTS;

    const pr = await this.prisma.purchaseRequest.create({
      data: {
        prNumber,
        createdById: userId,
        department: dto.department,
        prType: dto.prType,
        priority: dto.priority ?? 'medium',
        title: dto.title,
        description: dto.description,
        note: dto.note,
        budgetTotal: dto.budgetTotal,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        responsibleId: dto.responsibleId ?? null,
        approverId: dto.approverId ?? null,
        items: dto.items?.length
          ? { create: dto.items.map((i) => ({ name: i.name, detail: i.detail, qty: i.qty, unit: i.unit, budget: i.budget, neededBy: i.neededBy ? new Date(i.neededBy) : undefined })) }
          : undefined,
        checklists: {
          create: checklistLabels.map((label, i) => ({ label, sortOrder: i })),
        },
        activities: {
          create: { userId, action: 'created', newValue: 'draft' },
        },
      },
      include: this._include(),
    });
    return pr;
  }

  async findAll(filters: {
    userId: string;
    userRole: string;
    employeeId?: string;
    status?: string;
    priority?: string;
    department?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { userRole, userId, employeeId, status, priority, department, from, to, search, page = 1, limit = 50 } = filters;
    const where: Record<string, unknown> = {};

    // Role-based visibility
    if (userRole === 'sales') {
      // Sales sees only PRs they created OR are responsible for
      where.OR = [
        { createdById: userId },
        { responsible: { userId } },
      ];
    }
    // admin/closer/super_admin see all (with optional filters)

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (department) where.department = department;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}),
      };
    }
    if (search) {
      const orSearch = [
        { prNumber: { contains: search, mode: 'insensitive' as const } },
        { title: { contains: search, mode: 'insensitive' as const } },
        { department: { contains: search, mode: 'insensitive' as const } },
      ];
      if (where.OR) {
        // combine visibility + search
        where.AND = [{ OR: where.OR as object[] }, { OR: orSearch }];
        delete where.OR;
      } else {
        where.OR = orSearch;
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.purchaseRequest.count({ where }),
      this.prisma.purchaseRequest.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          responsible: { select: { id: true, name: true, code: true } },
          approver: { select: { id: true, name: true } },
          _count: { select: { items: true, comments: true, attachments: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, items };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const pr = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: this._include(),
    });
    if (!pr) throw new NotFoundException('PR ไม่พบ');
    if (userRole === 'sales') {
      const isOwner = pr.createdById === userId;
      const isResp = pr.responsible?.userId === userId;
      if (!isOwner && !isResp) throw new ForbiddenException('ไม่มีสิทธิ์ดู PR นี้');
    }
    return pr;
  }

  async update(id: string, userId: string, userRole: string, dto: UpdatePrDto) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });
    if (userRole === 'sales') {
      if (pr.createdById !== userId) throw new ForbiddenException('ไม่มีสิทธิ์แก้ไข');
      if (!['draft', 'submitted'].includes(pr.status)) throw new ForbiddenException('ไม่สามารถแก้ไข PR ที่อนุมัติแล้ว');
    }
    const updated = await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        ...dto,
        budgetTotal: dto.budgetTotal,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        activities: { create: { userId, action: 'edit', note: 'อัปเดตข้อมูล PR' } },
      },
      include: this._include(),
    });
    return updated;
  }

  async changeStatus(id: string, userId: string, userRole: string, newStatus: PrStatus, note?: string) {
    const pr = await this.prisma.purchaseRequest.findUniqueOrThrow({ where: { id } });

    // Validate role for status change
    if (newStatus === 'waiting_approval' || newStatus === 'submitted') {
      if (userRole === 'sales' && pr.createdById !== userId) throw new ForbiddenException();
    }
    if (['approved', 'cancelled'].includes(newStatus)) {
      if (!['admin', 'closer', 'super_admin'].includes(userRole)) throw new ForbiddenException('เฉพาะหัวหน้าหรือ Admin เท่านั้น');
    }

    const isClosing = CLOSED_STATUSES.includes(newStatus);
    const updated = await this.prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: newStatus,
        approvedAt: newStatus === 'approved' ? new Date() : undefined,
        closedAt: isClosing ? new Date() : undefined,
        cancelReason: newStatus === 'cancelled' ? note : undefined,
        activities: {
          create: { userId, action: 'status_change', oldValue: pr.status, newValue: newStatus, note },
        },
      },
      include: this._include(),
    });
    return updated;
  }

  async addComment(prId: string, userId: string, message: string) {
    const [comment] = await Promise.all([
      this.prisma.prComment.create({
        data: { prId, userId, message },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.prActivity.create({
        data: { prId, userId, action: 'comment', note: message.slice(0, 100) },
      }),
    ]);
    return comment;
  }

  async toggleChecklist(prId: string, checklistId: string, userId: string, isDone: boolean) {
    return this.prisma.prChecklist.update({
      where: { id: checklistId },
      data: { isDone, doneAt: isDone ? new Date() : null, doneById: isDone ? userId : null },
    });
  }

  async addItem(prId: string, userId: string, data: { name: string; detail?: string; qty: number; unit?: string; budget?: number; neededBy?: string }) {
    const [item] = await Promise.all([
      this.prisma.prItem.create({ data: { prId, ...data, neededBy: data.neededBy ? new Date(data.neededBy) : undefined } }),
      this.prisma.prActivity.create({ data: { prId, userId, action: 'edit', note: `เพิ่มรายการ: ${data.name}` } }),
    ]);
    return item;
  }

  async removeItem(prId: string, itemId: string, userId: string) {
    const item = await this.prisma.prItem.findFirstOrThrow({ where: { id: itemId, prId } });
    await Promise.all([
      this.prisma.prItem.delete({ where: { id: itemId } }),
      this.prisma.prActivity.create({ data: { prId, userId, action: 'edit', note: `ลบรายการ: ${item.name}` } }),
    ]);
    return { ok: true };
  }

  async addAttachment(prId: string, userId: string, data: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }) {
    const [att] = await Promise.all([
      this.prisma.prAttachment.create({ data: { prId, uploadedById: userId, ...data } }),
      this.prisma.prActivity.create({ data: { prId, userId, action: 'attachment', note: `อัปโหลด: ${data.fileName}` } }),
    ]);
    return att;
  }

  async deleteAttachment(prId: string, attId: string, userId: string, userRole: string) {
    const att = await this.prisma.prAttachment.findFirstOrThrow({ where: { id: attId, prId } });
    if (att.uploadedById !== userId && !['admin', 'super_admin'].includes(userRole)) throw new ForbiddenException();
    await this.prisma.prAttachment.delete({ where: { id: attId } });
    return { ok: true };
  }

  // ============================================================
  // Dashboard stats
  // ============================================================

  async dashboard(userRole: string, userId: string) {
    const where: Record<string, unknown> = {};
    if (userRole === 'sales') {
      where.OR = [{ createdById: userId }, { responsible: { userId } }];
    }

    const [total, open, overdue, completedToday, byStatus, byPriority, byDepartment, byResponsible, avgClosingDays] =
      await Promise.all([
        this.prisma.purchaseRequest.count({ where }),
        this.prisma.purchaseRequest.count({ where: { ...where, status: { in: OPEN_STATUSES } } }),
        this.prisma.purchaseRequest.count({ where: { ...where, status: { in: OPEN_STATUSES }, dueDate: { lt: new Date() } } }),
        this.prisma.purchaseRequest.count({ where: { ...where, status: 'completed', closedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        this.prisma.purchaseRequest.groupBy({ by: ['status'], where, _count: { _all: true } }),
        this.prisma.purchaseRequest.groupBy({ by: ['priority'], where, _count: { _all: true } }),
        this.prisma.purchaseRequest.groupBy({ by: ['department'], where, _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
        this.prisma.purchaseRequest.groupBy({ by: ['responsibleId'], where: { ...where, responsibleId: { not: null } }, _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
        this.prisma.$queryRaw<[{ avg_days: number }]>`
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400), 1) as avg_days
          FROM purchase_requests
          WHERE status = 'completed' AND closed_at IS NOT NULL
        `,
      ]);

    // Enrich responsible by name
    const respIds = byResponsible.map((r) => r.responsibleId).filter(Boolean) as string[];
    const emps = respIds.length
      ? await this.prisma.employee.findMany({ where: { id: { in: respIds } }, select: { id: true, name: true } })
      : [];
    const empMap = new Map(emps.map((e) => [e.id, e.name]));

    return {
      total,
      open,
      overdue,
      completedToday,
      avgClosingDays: Number(avgClosingDays[0]?.avg_days ?? 0),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
      byPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count._all })),
      byDepartment: byDepartment.map((r) => ({ department: r.department, count: r._count._all })),
      byResponsible: byResponsible.map((r) => ({ name: empMap.get(r.responsibleId ?? '') ?? r.responsibleId, count: r._count._all })),
    };
  }

  // ============================================================
  // Notification helpers
  // ============================================================

  /** PR ที่เปิดอยู่ และยังไม่ปิด — จัดกลุ่มตามผู้รับผิดชอบ */
  async getOpenPrsByEmployee() {
    const prs = await this.prisma.purchaseRequest.findMany({
      where: { status: { in: OPEN_STATUSES } },
      include: {
        responsible: { select: { id: true, name: true, lineUserId: true, userId: true, teamId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    const map = new Map<string, { employeeId: string; name: string; lineUserId: string | null; userId: string | null; teamId: string | null; prs: { prNumber: string; daysOpen: number; dueDate: Date | null }[] }>();
    const now = Date.now();
    for (const pr of prs) {
      if (!pr.responsible) continue;
      const key = pr.responsible.id;
      const entry = map.get(key) ?? { employeeId: key, name: pr.responsible.name, lineUserId: pr.responsible.lineUserId, userId: pr.responsible.userId, teamId: pr.responsible.teamId, prs: [] };
      entry.prs.push({ prNumber: pr.prNumber, daysOpen: Math.floor((now - pr.createdAt.getTime()) / 86400000), dueDate: pr.dueDate });
      map.set(key, entry);
    }
    return [...map.values()];
  }

  // ============================================================
  // Export CSV
  // ============================================================

  async exportData(filters: { status?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59Z') } : {}),
      };
    }
    return this.prisma.purchaseRequest.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        responsible: { select: { name: true } },
        approver: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private _include() {
    return {
      createdBy: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true, code: true, lineUserId: true, userId: true } },
      approver: { select: { id: true, name: true } },
      items: true,
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
      activities: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
      checklists: { orderBy: { sortOrder: 'asc' as const } },
      attachments: true,
    };
  }
}
