import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

const MONTH_TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const ADMIN_ROLES = ['admin', 'super_admin'];
const MANAGER_ROLES = ['admin', 'super_admin', 'closer'];

type DocType = 'sva' | 'svr' | 'mpa';

const NEXT_STATUS: Record<string, string[]> = {
  draft: ['pending_review', 'cancelled'],
  pending_review: ['pending_approval', 'draft', 'cancelled'],
  pending_approval: ['approved', 'pending_review', 'cancelled'],
  approved: ['signing'],
  signing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function workingDaysInMonth(month: number, year: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month - 1, 1);
  while (date.getMonth() === month - 1) {
    const d = date.getDay();
    if (d !== 0) days.push(new Date(date)); // exclude Sunday
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function nextDocNumber(docType: string, month: number, year: number, seq: number): string {
  return `${year}-${String(month).padStart(2,'0')}-${docType.toUpperCase()}-${String(seq).padStart(3,'0')}`;
}

@Injectable()
export class DocsService {
  constructor(private readonly prisma: PrismaService) {}

  private include() {
    return {
      employee: { select: { id: true, name: true, code: true, position: true, zone: true,
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } } } },
      supervisor: { select: { id: true, name: true } },
      closer: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      rows: { orderBy: { sortOrder: 'asc' as const } },
      signatures: {
        where: { revokedAt: null },
        include: { signedBy: { select: { id: true, name: true } } },
        orderBy: { signedAt: 'asc' as const },
      },
    };
  }

  async create(userId: string, dto: {
    docType: DocType; month: number; year: number;
    employeeId: string; supervisorId?: string; closerId?: string;
    companyName?: string; declaration?: string; notes?: string;
    requiredSigners?: string[];
    kpiSiteVisit?: number; kpiFollowup?: number; kpiNewAgency?: number; kpiTraining?: number; kpiSales?: number;
  }) {
    const count = await this.prisma.documentRecord.count({
      where: { docType: dto.docType, year: dto.year, month: dto.month },
    });
    const docNumber = nextDocNumber(dto.docType, dto.month, dto.year, count + 1);

    const doc = await this.prisma.documentRecord.create({
      data: {
        docType: dto.docType,
        docNumber,
        month: dto.month,
        year: dto.year,
        companyName: dto.companyName ?? 'บริษัท ทีทีจี โฮลดิ้ง จำกัด',
        declaration: dto.declaration,
        notes: dto.notes,
        requiredSigners: dto.requiredSigners ?? ['employee', 'supervisor'],
        kpiSiteVisit: dto.kpiSiteVisit,
        kpiFollowup: dto.kpiFollowup,
        kpiNewAgency: dto.kpiNewAgency,
        kpiTraining: dto.kpiTraining,
        kpiSales: dto.kpiSales,
        employeeId: dto.employeeId,
        supervisorId: dto.supervisorId,
        closerId: dto.closerId,
        createdById: userId,
      },
      include: this.include(),
    });

    await this.audit(doc.id, userId, 'create', { docType: dto.docType, docNumber });

    // seed default MPA KPI rows
    if (dto.docType === 'mpa') {
      const kpiNames = ['Site Visit','Follow-up','New Agency','Sales Support','Training'];
      await this.prisma.docRow.createMany({
        data: kpiNames.map((k, i) => ({ documentId: doc.id, rowType: 'kpi', kpiName: k, sortOrder: i })),
      });
    }
    // seed default SVR activity rows
    if (dto.docType === 'svr') {
      const acts = ['Promotion Presented','Training Conducted','Brochure Delivered',
        'Price List Delivered','Gift Delivered','Follow-up Created','Lead Generated'];
      await this.prisma.docRow.createMany({
        data: acts.map((a, i) => ({ documentId: doc.id, rowType: 'activity', activityName: a, activityDone: false, sortOrder: i })),
      });
    }

    return this.findOne(doc.id, userId, 'admin');
  }

  async findAll(filters: {
    docType?: string; status?: string; month?: number; year?: number;
    employeeId?: string; closerId?: string; search?: string;
    limit?: number; offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.docType) where.docType = filters.docType;
    if (filters.status) where.status = filters.status;
    if (filters.month) where.month = filters.month;
    if (filters.year) where.year = filters.year;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.closerId) where.closerId = filters.closerId;
    if (filters.search) {
      where.OR = [
        { docNumber: { contains: filters.search, mode: 'insensitive' } },
        { employee: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.documentRecord.count({ where }),
      this.prisma.documentRecord.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          signatures: { where: { revokedAt: null }, select: { signerType: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { version: 'desc' }],
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
      }),
    ]);

    return { total, items };
  }

  async findOne(id: string, userId: string, role: string) {
    const doc = await this.prisma.documentRecord.findUnique({
      where: { id },
      include: {
        ...this.include(),
        auditLogs: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        versions: {
          include: { createdBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } } },
          orderBy: { version: 'desc' },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(id: string, userId: string, role: string, dto: Record<string, unknown>) {
    const doc = await this.prisma.documentRecord.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    if (!MANAGER_ROLES.includes(role) && doc.status !== 'draft')
      throw new ForbiddenException('Cannot edit non-draft document');

    const updated = await this.prisma.documentRecord.update({
      where: { id },
      data: dto as never,
      include: this.include(),
    });
    await this.audit(id, userId, 'edit');
    return updated;
  }

  async changeStatus(id: string, userId: string, role: string, newStatus: string, note?: string) {
    const doc = await this.prisma.documentRecord.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();

    const allowed = NEXT_STATUS[doc.status] ?? [];
    if (!allowed.includes(newStatus))
      throw new ForbiddenException(`Cannot change from ${doc.status} to ${newStatus}`);

    if (newStatus === 'approved' && !ADMIN_ROLES.includes(role))
      throw new ForbiddenException('Only admin can approve');

    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'approved') {
      data.approvedById = userId;
      data.approvedAt = new Date();
    }
    if (newStatus === 'signing') {
      // Bump version and snapshot
      await this.prisma.docVersion.create({
        data: {
          documentId: id,
          version: doc.version,
          snapshot: (await this.findOne(id, userId, role)) as never,
          reason: note ?? 'Approved and sent for signing',
          createdById: userId,
        },
      });
    }

    await this.prisma.documentRecord.update({ where: { id }, data });
    await this.audit(id, userId, 'status_change', { from: doc.status, to: newStatus, note });

    return this.findOne(id, userId, role);
  }

  async generateSvaSchedule(id: string, userId: string, dto: {
    agencies: { id?: string; name: string; province: string; contactPerson?: string; level?: string }[];
    startDate?: string;
  }) {
    const doc = await this.prisma.documentRecord.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();

    const days = workingDaysInMonth(doc.month, doc.year);
    const slots: { date: Date; time: string }[] = [];
    for (const d of days) {
      slots.push({ date: d, time: '09:00' });
      slots.push({ date: d, time: '14:00' });
    }

    // Visits per agency based on level
    const levelFreq: Record<string, number> = { VIP: 8, A: 4, B: 2, C: 1, D: 1 };
    const schedule: Array<{
      visitDate: Date; visitTime: string; agencyId?: string;
      agencyName: string; contactPerson?: string;
      province: string; visitType: string; priority: string;
      status: string; sortOrder: number;
    }> = [];

    let slotIdx = 0;
    for (const ag of dto.agencies) {
      const freq = levelFreq[ag.level ?? 'C'];
      for (let i = 0; i < freq && slotIdx < slots.length; i++) {
        const slot = slots[slotIdx++];
        schedule.push({
          visitDate: slot.date,
          visitTime: slot.time,
          agencyId: ag.id,
          agencyName: ag.name,
          contactPerson: ag.contactPerson,
          province: ag.province,
          visitType: 'site_visit',
          priority: ag.level === 'VIP' || ag.level === 'A' ? 'high' : 'medium',
          status: 'scheduled',
          sortOrder: schedule.length,
        });
      }
    }

    // Delete existing schedule rows and recreate
    await this.prisma.docRow.deleteMany({ where: { documentId: id, rowType: 'schedule' } });
    if (schedule.length > 0) {
      await this.prisma.docRow.createMany({
        data: schedule.map(s => ({ ...s, documentId: id, rowType: 'schedule' })),
      });
    }

    await this.audit(id, userId, 'generate_schedule', { count: schedule.length });
    return this.findOne(id, userId, 'admin');
  }

  async addRow(id: string, dto: Record<string, unknown>) {
    const count = await this.prisma.docRow.count({ where: { documentId: id } });
    return this.prisma.docRow.create({
      data: { ...dto, documentId: id, sortOrder: count } as never,
    });
  }

  async updateRow(documentId: string, rowId: string, dto: Record<string, unknown>) {
    return this.prisma.docRow.update({ where: { id: rowId }, data: dto as never });
  }

  async deleteRow(documentId: string, rowId: string) {
    await this.prisma.docRow.delete({ where: { id: rowId } });
  }

  async addSignature(id: string, userId: string, dto: { signerType: string; signatureData: string }) {
    const doc = await this.prisma.documentRecord.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    if (doc.status !== 'signing') throw new ForbiddenException('Document is not in signing status');

    // Check not already signed
    const existing = await this.prisma.docSignature.findFirst({
      where: { documentId: id, signerType: dto.signerType, revokedAt: null },
    });
    if (existing) throw new ForbiddenException(`Already signed as ${dto.signerType}`);

    const sig = await this.prisma.docSignature.create({
      data: { documentId: id, signerType: dto.signerType, signedById: userId, signatureData: dto.signatureData },
    });

    await this.audit(id, userId, `${dto.signerType}_sign`);

    // Check if all required signers have signed → auto-complete
    const signedTypes = await this.prisma.docSignature.findMany({
      where: { documentId: id, revokedAt: null },
      select: { signerType: true },
    });
    const signedSet = new Set(signedTypes.map(s => s.signerType));
    const allSigned = doc.requiredSigners.every(r => signedSet.has(r));
    if (allSigned) {
      await this.prisma.documentRecord.update({ where: { id }, data: { status: 'completed' } });
      await this.audit(id, userId, 'completed');
    }

    return sig;
  }

  async revokeSignature(documentId: string, sigId: string, userId: string, reason: string) {
    await this.prisma.docSignature.update({
      where: { id: sigId },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
    // Revert to signing status if completed
    await this.prisma.documentRecord.updateMany({
      where: { id: documentId, status: 'completed' },
      data: { status: 'signing' },
    });
    await this.audit(documentId, userId, 'revoke_signature', { sigId, reason });
  }

  async dashboard(docType?: string, year?: number) {
    const baseWhere: Record<string, unknown> = {};
    if (docType) baseWhere.docType = docType;
    if (year) baseWhere.year = year;

    const [total, pendingSignature, signing, completed, cancelled] = await Promise.all([
      this.prisma.documentRecord.count({ where: baseWhere }),
      this.prisma.documentRecord.count({ where: { ...baseWhere, status: 'signing' } }),
      this.prisma.documentRecord.count({ where: { ...baseWhere, status: 'signing' } }),
      this.prisma.documentRecord.count({ where: { ...baseWhere, status: 'completed' } }),
      this.prisma.documentRecord.count({ where: { ...baseWhere, status: 'cancelled' } }),
    ]);

    const byType = await this.prisma.documentRecord.groupBy({
      by: ['docType'],
      where: baseWhere,
      _count: { _all: true },
    });
    const byStatus = await this.prisma.documentRecord.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    });

    return { total, pendingSignature, signing, completed, cancelled, byType, byStatus };
  }

  async getAuditLogs(documentId: string) {
    return this.prisma.docAuditLog.findMany({
      where: { documentId },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNewVersion(id: string, userId: string, reason: string) {
    const doc = await this.prisma.documentRecord.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();

    const newVersion = doc.version + 1;
    const snapshot = await this.findOne(id, userId, 'admin');

    await Promise.all([
      this.prisma.docVersion.create({
        data: { documentId: id, version: newVersion, snapshot: snapshot as never, reason, createdById: userId },
      }),
      this.prisma.documentRecord.update({
        where: { id },
        data: { version: newVersion, status: 'draft' },
      }),
      // revoke pending signatures
      this.prisma.docSignature.updateMany({
        where: { documentId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: `Version updated to V${newVersion}: ${reason}` },
      }),
    ]);

    await this.audit(id, userId, 'new_version', { version: newVersion, reason });
    return this.findOne(id, userId, 'admin');
  }

  async getPendingSignatures() {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    return this.prisma.documentRecord.findMany({
      where: { status: 'signing' },
      include: {
        employee: { select: { name: true, lineUserId: true } },
        signatures: { where: { revokedAt: null }, select: { signerType: true, signedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async audit(documentId: string, actorId: string, action: string, detail?: Record<string, unknown>) {
    await this.prisma.docAuditLog.create({ data: { documentId, actorId, action, detail: (detail as never) } });
  }
}
