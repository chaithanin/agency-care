import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { LineService } from '../notification/line.service';
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
    private notif: NotificationService,
    private line: LineService,
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
          select: {
            visitPlans: { where: { status: 'done' } },
            tasks: { where: { tag: 'call', status: 'done' } },
            appointments: true,
          },
        },
        commissions: {
          select: { type: true, amount: true },
        },
      },
    });
    return agencies.map((a) => {
      const totalCommission = a.commissions
        .filter((c) => c.type === 'commission')
        .reduce((s, c) => s + Number(c.amount), 0);
      const totalBonus = a.commissions
        .filter((c) => c.type === 'bonus')
        .reduce((s, c) => s + Number(c.amount), 0);
      return {
        ...a,
        lastVisitDate: a.visitPlans[0]?.planDate?.toISOString().slice(0, 10) ?? null,
        completedVisits: a._count.visitPlans,
        callCount: a._count.tasks,
        appointmentCount: a._count.appointments,
        totalCommission,
        totalBonus,
        visitPlans: undefined,
        commissions: undefined,
      };
    });
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
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: {
        assignments: { where: { isActive: true }, include: { employee: true }, take: 1 },
        addedBy: { select: { id: true } },
      },
    });
    if (!agency) throw new Error('Agency not found');
    const updated = await this.prisma.agency.update({
      where: { id },
      data: { approvalStatus: 'approved', pipelineStage: 'onboarding' },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'approve', entity: 'agency', entityId: id,
        metadata: { changes: [`approvalStatus: ${agency.approvalStatus} → approved`, 'pipelineStage → onboarding'] } },
    });

    // สร้าง onboarding tasks อัตโนมัติ
    const assigneeId = (agency.assignments[0]?.employee?.id ?? agency.addedBy?.id) ?? null;
    if (assigneeId) {
      const now = new Date();
      const addDays = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() + d); return dt; };
      const onboardingTasks = [
        { title: `[Onboarding] เข้าเยี่ยมแนะนำตัวครั้งแรก — ${agency.name}`, tag: 'visit', dueDate: addDays(7), priority: 'high' as const },
        { title: `[Onboarding] ส่งสื่อโครงการ/แคตตาล็อก — ${agency.name}`, tag: 'delivery', dueDate: addDays(3), priority: 'medium' as const },
        { title: `[Onboarding] โทรติดตาม 1 สัปดาห์หลัง Approve — ${agency.name}`, tag: 'call', dueDate: addDays(14), priority: 'medium' as const },
        { title: `[Onboarding] นัด Orientation ลูกค้า — ${agency.name}`, tag: 'orientation', dueDate: addDays(21), priority: 'medium' as const },
      ];
      await Promise.all(
        onboardingTasks.map((task) =>
          this.prisma.task.create({
            data: {
              title: task.title,
              tag: task.tag,
              priority: task.priority,
              dueDate: task.dueDate,
              status: 'pending',
              type: 'auto',
              agencyId: id,
              assignedToId: assigneeId,
            },
          }),
        ),
      );
    }

    // Phase 1: Welcome email + LINE greeting
    const assigneeEmployee = agency.assignments[0]?.employee ?? null;
    const assigneeName = assigneeEmployee?.name ?? 'ทีมงาน';
    await this.sendWelcomeEmail(
      { name: agency.name, email: agency.email, code: agency.code },
      assigneeName,
    );
    await this.sendFirstLineGreeting(agency.name, assigneeName, assigneeEmployee as any);

    return updated;
  }

  private async sendFirstLineGreeting(
    agencyName: string,
    assigneeName: string,
    assigneeEmployee: { lineUserId?: string | null } | null,
  ) {
    if (!assigneeEmployee?.lineUserId || !this.line.enabled) return;
    const text = [
      `🎉 เอเจนซี่ใหม่ได้รับการอนุมัติแล้ว!`,
      ``,
      `🏢 ${agencyName}`,
      `👤 Seller ที่รับผิดชอบ: ${assigneeName}`,
      ``,
      `📋 ขั้นตอนต่อไป:`,
      `1. เชิญเข้า LINE Group โครงการ`,
      `2. ส่ง POSM / Catalog ภายใน 3 วัน`,
      `3. นัด Orientation ภายใน 1 สัปดาห์`,
      ``,
      `ระบบได้สร้าง Task onboarding ให้อัตโนมัติแล้วใน /tasks`,
    ].join('\n');
    await this.line.pushText(assigneeEmployee.lineUserId, text);
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

  // ─── Commission / Bonus ─────────────────────────────────────────────────────

  async listCommissions(agencyId: string) {
    return this.prisma.agencyCommission.findMany({
      where: { agencyId },
      orderBy: { periodDate: 'desc' },
    });
  }

  async addCommission(
    agencyId: string,
    data: { type: string; amount: number; periodDate: string; description?: string },
    userId: string,
  ) {
    return this.prisma.agencyCommission.create({
      data: {
        agencyId,
        type: data.type,
        amount: data.amount,
        periodDate: new Date(data.periodDate),
        description: data.description,
        recordedById: userId,
      },
    });
  }

  async deleteCommission(agencyId: string, commissionId: string) {
    return this.prisma.agencyCommission.delete({
      where: { id: commissionId, agencyId },
    });
  }

  // ── Stop/Resume Automation ────────────────────────────────────────────────
  async toggleAutomation(id: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id }, select: { automationPaused: true, name: true } });
    if (!agency) throw new NotFoundException('Agency not found');
    const next = !agency.automationPaused;
    await this.prisma.agency.update({ where: { id }, data: { automationPaused: next } });
    return { id, automationPaused: next, message: next ? `หยุด Automation สำหรับ ${agency.name} แล้ว` : `เปิด Automation สำหรับ ${agency.name} แล้ว` };
  }

  // ── Send Welcome Email (called from approveAgency) ────────────────────────
  async sendWelcomeEmail(agency: { name: string; email: string | null; code: string }, assigneeName: string) {
    if (!agency.email) return false;
    const appUrl = process.env.APP_URL ?? 'https://agency.chaithanin.com';
    const html = `
<h2>ยินดีต้อนรับสู่ Chaithanin Agency Network!</h2>
<p>เรียน ทีมงาน ${agency.name},</p>
<p>ยินดีต้อนรับสู่โครงการ Chaithanin! ทางทีมของเราได้อนุมัติการเป็น Agency Partner เรียบร้อยแล้ว</p>
<h3>ข้อมูลสำหรับเข้าระบบ</h3>
<ul>
  <li><b>รหัส Agency:</b> ${agency.code}</li>
  <li><b>ลิงก์ดู Price List & ขอใบเสนอราคา:</b> <a href="${appUrl}/products">${appUrl}/products</a></li>
</ul>
<h3>ขั้นตอนถัดไป</h3>
<ol>
  <li>ดาวน์โหลดแคตตาล็อกและข้อมูลโครงการได้ที่ลิงก์ด้านบน</li>
  <li>ทีม Seller ของเราจะติดต่อนัดหมาย Orientation ภายใน 7 วัน</li>
  <li>รับสื่อการตลาด (POSM) พร้อมเริ่มแนะนำลูกค้า</li>
</ol>
<p>หากมีข้อสงสัยติดต่อ Seller ของท่าน: <b>${assigneeName}</b></p>
<p>ขอบคุณที่ร่วมเป็นส่วนหนึ่งของครอบครัว Chaithanin 🙏</p>`;
    return this.notif.sendEmail(agency.email, `ยินดีต้อนรับ ${agency.name} สู่ Chaithanin Agency Network!`, html);
  }
}
