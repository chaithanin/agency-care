import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

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
  async checkDuplicate(params: { name?: string; phone?: string; code?: string }) {
    const conditions: any[] = [];
    if (params.code) conditions.push({ code: { equals: params.code, mode: 'insensitive' } });
    if (params.phone) conditions.push({ phone: params.phone });
    if (params.name) {
      // ตัดคำสั้นมาก (น้อยกว่า 4 ตัว) ออก
      const trimmed = params.name.trim();
      if (trimmed.length >= 4) {
        conditions.push({ name: { contains: trimmed.slice(0, 20), mode: 'insensitive' } });
      }
    }
    if (!conditions.length) return { duplicates: [] };
    const hits = await this.prisma.agency.findMany({
      where: { OR: conditions },
      select: { id: true, code: true, name: true, phone: true, province: true, status: true },
      take: 5,
    });
    return { duplicates: hits };
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
    return agency;
  }

  async update(id: string, dto: UpdateAgencyDto, userId?: string) {
    const before = await this.get(id);
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
}
