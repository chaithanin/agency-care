import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

function calcAgencyScore(totalUnits: number): string {
  if (totalUnits >= 50) return 'A';
  if (totalUnits >= 20) return 'B';
  if (totalUnits >= 1) return 'C';
  return 'D';
}

@Injectable()
export class AgencyService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async list(params: { zone?: string; status?: string; q?: string }) {
    const where: Prisma.AgencyWhereInput = {};
    if (params.zone) where.zone = params.zone;
    if (params.status === 'active' || params.status === 'inactive') where.status = params.status;
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { code: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    const agencies = await this.prisma.agency.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        assignments: {
          where: { isActive: true },
          include: { employee: { select: { id: true, name: true, code: true } } },
        },
        visitPlans: {
          where: { status: 'done' },
          orderBy: { planDate: 'desc' },
          take: 1,
          select: { planDate: true },
        },
        _count: {
          select: { visitPlans: { where: { status: 'done' } } },
        },
      },
    });
    return agencies.map((a) => ({
      ...a,
      lastVisitDate: a.visitPlans[0]?.planDate?.toISOString().slice(0, 10) ?? null,
      completedVisits: a._count.visitPlans,
      visitPlans: undefined,
    }));
  }

  async get(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { isActive: true },
          include: { employee: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    if (!agency) throw new NotFoundException('ไม่พบ Agency');
    return agency;
  }

  // Phase 7: สรุป pipeline (จำนวนต่อ stage + tier)
  async pipelineStats() {
    const [byStage, byTier, total] = await Promise.all([
      this.prisma.agency.groupBy({ by: ['pipelineStage'], where: { status: 'active' }, _count: { _all: true } }),
      this.prisma.agency.groupBy({ by: ['tier'], where: { status: 'active' }, _count: { _all: true } }),
      this.prisma.agency.count({ where: { status: 'active' } }),
    ]);
    return {
      total,
      stages: Object.fromEntries(byStage.map((s) => [s.pipelineStage, s._count._all])),
      tiers: Object.fromEntries(byTier.map((t) => [t.tier, t._count._all])),
    };
  }

  // ตรวจ duplicate ก่อนสร้าง — คืน array ของรายการที่น่าสงสัย
  async checkDuplicate(name: string, phone?: string, email?: string, excludeId?: string) {
    const where: Prisma.AgencyWhereInput = {
      AND: [
        excludeId ? { id: { not: excludeId } } : {},
        {
          OR: [
            { name: { contains: name.trim(), mode: 'insensitive' } },
            ...(phone ? [{ phone: { equals: phone.trim() } }] : []),
            ...(email ? [{ email: { equals: email.trim(), mode: 'insensitive' as Prisma.QueryMode } }] : []),
          ],
        },
      ],
    };
    return this.prisma.agency.findMany({
      where,
      select: { id: true, code: true, name: true, phone: true, email: true, status: true, addedById: true },
      take: 5,
    });
  }

  async create(dto: CreateAgencyDto, userId?: string) {
    const dup = await this.prisma.agency.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`รหัส Agency ${dto.code} ถูกใช้แล้ว`);
    const { profileData: pd, ...rest } = dto;
    const agency = await this.prisma.agency.create({
      data: { ...rest, ...(pd !== undefined ? { profileData: pd as Prisma.InputJsonValue } : {}) },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'create', entity: 'agency', entityId: agency.id,
        metadata: { after: { name: agency.name, code: agency.code } } },
    });
    const score = calcAgencyScore(dto.totalUnitsSold ?? 0);
    if (score !== 'D') {
      await this.prisma.agency.update({ where: { id: agency.id }, data: { agencyScore: score } });
    }
    return agency;
  }

  async update(id: string, dto: UpdateAgencyDto, userId?: string) {
    const before = await this.get(id);
    if (dto.totalUnitsSold !== undefined) {
      dto.agencyScore = calcAgencyScore(dto.totalUnitsSold);
    }
    const { profileData: pd, ...rest } = dto;
    const data: Prisma.AgencyUpdateInput = {
      ...rest,
      ...(pd !== undefined ? { profileData: pd as Prisma.InputJsonValue } : {}),
    };
    if (dto.latitude != null && dto.longitude != null) data.geocodeSource = 'manual';
    const after = await this.prisma.agency.update({ where: { id }, data });
    // บันทึก fields ที่เปลี่ยน
    const changes = Object.keys(dto).filter(
      (k) => (before as any)[k] !== (dto as any)[k],
    );
    if (changes.length) {
      const beforeSnap = Object.fromEntries(changes.map((k) => [k, (before as any)[k]]));
      const afterSnap = Object.fromEntries(changes.map((k) => [k, (after as any)[k]]));
      await this.prisma.auditLog.create({
        data: { userId, action: 'update', entity: 'agency', entityId: id,
          metadata: { before: beforeSnap, after: afterSnap, changes } },
      });
    }
    return after;
  }

  async getContractExpiryAlerts(): Promise<{ agencyId: string; name: string; expiry: Date; daysLeft: number }[]> {
    const today = new Date();
    const in90 = new Date(today);
    in90.setDate(today.getDate() + 90);
    const results = await this.prisma.agency.findMany({
      where: {
        agreementActive: true,
        agreementExpiry: { gte: today, lte: in90 },
        status: 'active',
      },
      select: { id: true, name: true, agreementExpiry: true },
      orderBy: { agreementExpiry: 'asc' },
    });
    return results
      .filter((a) => a.agreementExpiry)
      .map((a) => {
        const daysLeft = Math.ceil((a.agreementExpiry!.getTime() - today.getTime()) / 86400000);
        return { agencyId: a.id, name: a.name, expiry: a.agreementExpiry!, daysLeft };
      });
  }

  // ── Agency Timeline ────────────────────────────────────────────────────────
  async getTimeline(agencyId: string) {
    const [agency, visits, auditEntries, assignments] = await Promise.all([
      this.prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true, createdAt: true } }),
      this.prisma.visitPlan.findMany({
        where: { agencyId },
        include: {
          employee: { select: { name: true, code: true } },
          report: { select: { visitType: true, purposes: true, summary: true, interestLevel: true, newLeads: true } },
          checkin: { select: { checkinAt: true, checkOutAt: true, durationMinutes: true } },
        },
        orderBy: { planDate: 'desc' },
        take: 100,
      }),
      this.prisma.auditLog.findMany({
        where: { entity: 'agency', entityId: agencyId },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.agencyAssignment.findMany({
        where: { agencyId },
        include: { employee: { select: { name: true, code: true } } },
        orderBy: { assignedAt: 'desc' },
      }),
    ]);

    if (!agency) throw new NotFoundException('ไม่พบ Agency');

    type TimelineEvent = {
      type: string; date: string; actor?: string;
      icon?: string; description: string; metadata?: any;
    };

    const events: TimelineEvent[] = [];

    // Audit events (create/update)
    for (const a of auditEntries) {
      if (a.action === 'create') {
        events.push({ type: 'created', date: a.createdAt.toISOString(),
          actor: a.user?.name ?? 'System', icon: 'create',
          description: 'เพิ่ม Agency เข้าระบบ' });
      } else if (a.action === 'update') {
        const meta = a.metadata as any;
        const changed: string[] = meta?.changes ?? [];
        events.push({ type: 'updated', date: a.createdAt.toISOString(),
          actor: a.user?.name ?? 'System', icon: 'edit',
          description: `แก้ไขข้อมูล${changed.length ? ': ' + changed.join(', ') : ''}`,
          metadata: meta });
      }
    }

    // Assignment events
    for (const asg of assignments) {
      events.push({ type: 'assigned', date: asg.assignedAt.toISOString(),
        actor: 'System', icon: 'person',
        description: `มอบหมายให้ ${asg.employee.name} (${asg.employee.code})${asg.isActive ? '' : ' [ยกเลิกแล้ว]'}` });
    }

    // Visit events
    for (const v of visits) {
      const statusLabel: Record<string, string> = {
        done: '✅ เสร็จสิ้น', cancelled: '❌ ยกเลิก', pending: '📅 รอ',
        on_route: '🚗 กำลังเดินทาง', waiting_confirmation: '⏳ รอยืนยัน', postponed: '📌 เลื่อน',
      };
      const typeLabel = v.report?.visitType === 'agency_brings_client' ? 'AG พา Client มา' : 'ไปเยี่ยม Agency';
      events.push({
        type: 'visit', date: v.planDate.toISOString(),
        actor: v.employee.name, icon: 'visit',
        description: `${statusLabel[v.status] ?? v.status} — ${typeLabel}`,
        metadata: {
          status: v.status,
          visitType: v.report?.visitType,
          purposes: v.report?.purposes ?? [],
          summary: v.report?.summary,
          interestLevel: v.report?.interestLevel,
          newLeads: v.report?.newLeads ?? 0,
          checkinAt: v.checkin?.checkinAt,
          duration: v.checkin?.durationMinutes,
          employee: v.employee.name,
        },
      });
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { agencyId, agencyName: agency.name, events };
  }

  // ── Bulk Import (Venio CRM / Excel) ──────────────────────────────────────
  async bulkImport(rows: any[]): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const code = String(row.code || '').trim();
      if (!code) { skipped++; continue; }
      const name = String(row.name || '').trim();
      if (!name || name === '-' || name === '- -') { skipped++; continue; }

      try {
        const existing = await this.prisma.agency.findUnique({ where: { code } });
        const agencyScore = row.totalUnitsSold != null ? calcAgencyScore(Number(row.totalUnitsSold)) : row.agencyScore;

        const data: Prisma.AgencyCreateInput = {
          code,
          name,
          ...(row.status && { status: row.status }),
          ...(row.level && { level: row.level }),
          ...(row.tier && { tier: row.tier }),
          ...(row.pipelineStage && { pipelineStage: row.pipelineStage }),
          ...(row.phone && { phone: String(row.phone) }),
          ...(row.email && { email: String(row.email) }),
          ...(row.website && { website: String(row.website) }),
          ...(row.tiktok && { tiktok: String(row.tiktok) }),
          ...(row.ownerName && { ownerName: String(row.ownerName) }),
          ...(row.type && { type: String(row.type) }),
          ...(row.classification && { classification: String(row.classification) }),
          ...(row.gradeQuality && { gradeQuality: String(row.gradeQuality) }),
          ...(row.gradeRelationship && { gradeRelationship: String(row.gradeRelationship) }),
          ...(row.source && { source: String(row.source) }),
          ...(row.tags && { tags: String(row.tags) }),
          ...(row.remark && { remark: String(row.remark) }),
          ...(row.province && { province: String(row.province) }),
          ...(row.zone && { zone: String(row.zone) }),
          ...(row.address && { address: String(row.address) }),
          ...(row.latitude != null && { latitude: Number(row.latitude) }),
          ...(row.longitude != null && { longitude: Number(row.longitude) }),
          ...(row.geocodeSource && { geocodeSource: String(row.geocodeSource) }),
          ...(agencyScore && { agencyScore }),
          ...(row.advertisesOurProjects != null && { advertisesOurProjects: Boolean(row.advertisesOurProjects) }),
          ...(row.sellsOurProjects != null && { sellsOurProjects: Boolean(row.sellsOurProjects) }),
        };

        if (existing) {
          const { code: _c, ...updateData } = data as any;
          await this.prisma.agency.update({ where: { code }, data: updateData });
          updated++;
        } else {
          await this.prisma.agency.create({ data });
          created++;
        }
      } catch (e: any) {
        errors.push(`${code}: ${e.message}`);
        if (errors.length >= 20) break;
      }
    }

    return { created, updated, skipped, errors };
  }

  // เติมพิกัดอัตโนมัติให้ agency ที่ยังไม่มี ผ่าน Google Geocoding API
  async geocodeMissing(limit = 50) {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) {
      throw new BadRequestException('ยังไม่ได้ตั้ง GOOGLE_MAPS_API_KEY ใน .env');
    }
    const targets = await this.prisma.agency.findMany({
      where: { latitude: null },
      take: limit,
      orderBy: { code: 'asc' },
    });

    let found = 0;
    const failedNames: string[] = [];
    for (const a of targets) {
      const address = encodeURIComponent(`${a.name} ${a.zone ?? 'Pattaya'} Thailand`);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&region=th&language=th&key=${key}`;
      try {
        const res = await fetch(url);
        const data = (await res.json()) as {
          results?: { geometry?: { location?: { lat: number; lng: number } } }[];
        };
        const loc = data.results?.[0]?.geometry?.location;
        if (loc?.lat && loc?.lng) {
          await this.prisma.agency.update({
            where: { id: a.id },
            data: { latitude: loc.lat, longitude: loc.lng, geocodeSource: 'google' },
          });
          found++;
        } else {
          failedNames.push(a.name);
        }
      } catch {
        failedNames.push(a.name);
      }
      // กัน rate limit
      await new Promise((r) => setTimeout(r, 120));
    }

    const remaining = await this.prisma.agency.count({ where: { latitude: null } });
    return {
      processed: targets.length,
      found,
      failed: failedNames.length,
      failedNames: failedNames.slice(0, 20),
      remaining,
      note: 'พิกัด auto (google) ควรตรวจความถูกต้องก่อนใช้ check-in',
    };
  }

  // ─── Agency Approval Workflow ──────────────────────────────────────────────

  async submitForApproval(id: string, userId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new Error('Agency not found');
    const updated = await this.prisma.agency.update({
      where: { id },
      data: { approvalStatus: 'pending_approval' },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'update', entity: 'agency', entityId: id,
        metadata: { changes: ['approvalStatus: draft → pending_approval'] } },
    });
    return updated;
  }

  async approveAgency(id: string, userId: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new Error('Agency not found');
    const updated = await this.prisma.agency.update({
      where: { id },
      data: { approvalStatus: 'approved' },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'update', entity: 'agency', entityId: id,
        metadata: { changes: [`approvalStatus: ${agency.approvalStatus} → approved`] } },
    });
    return updated;
  }

  async rejectAgency(id: string, userId: string, reason?: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) throw new Error('Agency not found');
    const updated = await this.prisma.agency.update({
      where: { id },
      data: { approvalStatus: 'draft' },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'update', entity: 'agency', entityId: id,
        metadata: { changes: [`approvalStatus: ${agency.approvalStatus} → draft`], reason } },
    });
    return updated;
  }

  async listByApprovalStatus(status: string) {
    return this.prisma.agency.findMany({
      where: { approvalStatus: status },
      select: { id: true, code: true, name: true, zone: true, approvalStatus: true,
        createdAt: true, addedBy: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
