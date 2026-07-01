import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AssignmentPlanStatus, VisitStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/current-user.decorator';
import { ApprovePlanDto, GeneratePlanDto, SaveVersionDto, SubmitPlanDto } from './assignment-plan.dto';

@Injectable()
export class AssignmentPlanService {
  constructor(private prisma: PrismaService) {}

  // ─── สร้างแผนใหม่ (AI propose → draft) ─────────────────────────────────
  async generate(user: RequestUser, dto: GeneratePlanDto) {
    const { period, maxPerSales, title } = dto;

    // ตรวจว่าไม่มีแผน active/published สำหรับเดือนนี้อยู่แล้ว
    const existing = await this.prisma.assignmentPlan.findFirst({
      where: { period, status: { in: ['published', 'active'] } },
    });
    if (existing) {
      throw new BadRequestException(`มีแผน ${period} ที่ Published/Active อยู่แล้ว (ID: ${existing.id})`);
    }

    const cap = maxPerSales && maxPerSales > 0 ? maxPerSales : undefined;

    // โหลด agencies + sales employees
    const [agencies, employees] = await Promise.all([
      this.prisma.agency.findMany({
        where: { status: 'active' },
        select: { id: true, code: true, name: true, zone: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { isActive: true, position: 'sales' },
        select: { id: true, name: true, code: true, zone: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    if (employees.length === 0) {
      throw new BadRequestException('ยังไม่มีเซลส์ (Sales) ในระบบ');
    }

    // ─── Algorithm: zone-balanced distribution ─────────────────────────
    const load = new Map<string, number>(employees.map((e) => [e.id, 0]));
    const hasRoom = (e: { id: string }) => cap === undefined || (load.get(e.id) ?? 0) < cap;

    const proposalItems = agencies
      .map((a) => {
        const sameZone = a.zone ? employees.filter((e) => e.zone === a.zone && hasRoom(e)) : [];
        const pool = sameZone.length ? sameZone : employees.filter(hasRoom);
        if (!pool.length) return null; // เต็มโควต้า
        const chosen = pool.reduce((best, e) => ((load.get(e.id) ?? 0) < (load.get(best.id) ?? 0) ? e : best));
        load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1);
        return { agencyId: a.id, employeeId: chosen.id };
      })
      .filter(Boolean) as { agencyId: string; employeeId: string }[];

    // ─── บันทึก plan + version 1 ──────────────────────────────────────────
    const planId = randomUUID();
    const versionId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.assignmentPlan.create({
        data: {
          id: planId,
          period,
          title: title ?? `แผนประจำเดือน ${period}`,
          status: 'draft',
          totalAgencies: proposalItems.length,
          totalSales: employees.length,
          createdById: user.id,
        },
      });

      await tx.planVersion.create({
        data: {
          id: versionId,
          planId,
          versionNo: 1,
          note: 'AI สร้างแผนอัตโนมัติ',
          isCurrent: true,
          createdById: user.id,
          items: {
            createMany: {
              data: proposalItems.map((p) => ({
                id: randomUUID(),
                agencyId: p.agencyId,
                employeeId: p.employeeId,
              })),
            },
          },
        },
      });
    });

    return this.getById(user, planId);
  }

  // ─── List all plans ──────────────────────────────────────────────────────
  async list() {
    const plans = await this.prisma.assignmentPlan.findMany({
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        versions: { select: { id: true, versionNo: true, note: true, isCurrent: true, createdAt: true } },
      },
    });
    return plans;
  }

  // ─── Get plan detail with current version items ───────────────────────────
  async getById(user: RequestUser, planId: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNo: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
            items: {
              include: {
                agency: { select: { id: true, code: true, name: true, zone: true } },
                employee: { select: { id: true, code: true, name: true, zone: true } },
              },
            },
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('ไม่พบแผน');
    return plan;
  }

  // ─── แก้ไข items → สร้าง version ใหม่ ───────────────────────────────────
  async saveVersion(user: RequestUser, planId: string, dto: SaveVersionDto) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('ไม่พบแผน');
    if (['published', 'active', 'closed'].includes(plan.status)) {
      throw new ForbiddenException('แผนที่ Published/Active/Closed ไม่สามารถแก้ไขได้');
    }

    // หา version ปัจจุบัน
    const currentVersion = await this.prisma.planVersion.findFirst({
      where: { planId, isCurrent: true },
      orderBy: { versionNo: 'desc' },
    });
    const nextVersionNo = currentVersion ? currentVersion.versionNo + 1 : 1;
    const newVersionId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      // ยกเลิก isCurrent ของ version เดิม
      if (currentVersion) {
        await tx.planVersion.update({
          where: { id: currentVersion.id },
          data: { isCurrent: false },
        });
      }
      // สร้าง version ใหม่
      await tx.planVersion.create({
        data: {
          id: newVersionId,
          planId,
          versionNo: nextVersionNo,
          note: dto.note ?? `แก้ไขโดย ${user.name}`,
          isCurrent: true,
          createdById: user.id,
          items: {
            createMany: {
              data: dto.items.map((item) => ({
                id: randomUUID(),
                agencyId: item.agencyId,
                employeeId: item.employeeId,
                isLocked: item.isLocked ?? false,
                note: item.note,
              })),
            },
          },
        },
      });

      // update totalAgencies
      await tx.assignmentPlan.update({
        where: { id: planId },
        data: { totalAgencies: dto.items.length },
      });
    });

    return this.getById(user, planId);
  }

  // ─── ส่งอนุมัติ: draft → pending_approval ─────────────────────────────
  async submit(user: RequestUser, planId: string, dto: SubmitPlanDto) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('ไม่พบแผน');
    if (plan.status !== 'draft') {
      throw new BadRequestException('เฉพาะแผน Draft เท่านั้นที่ส่งอนุมัติได้');
    }
    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: { status: 'pending_approval' },
    });
  }

  // ─── อนุมัติ: pending_approval → approved (admin/super_admin only) ────
  async approve(user: RequestUser, planId: string, dto: ApprovePlanDto) {
    if (!['admin', 'super_admin'].includes(user.role)) {
      throw new ForbiddenException('เฉพาะ Admin เท่านั้น');
    }
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('ไม่พบแผน');
    if (plan.status !== 'pending_approval') {
      throw new BadRequestException('เฉพาะแผนที่รอการอนุมัติเท่านั้น');
    }
    return this.prisma.assignmentPlan.update({
      where: { id: planId },
      data: {
        status: 'approved',
        approvedById: user.id,
        approvedAt: new Date(),
      },
    });
  }

  // ─── Publish → apply AgencyAssignment ────────────────────────────────────
  async publish(user: RequestUser, planId: string) {
    if (!['admin', 'super_admin'].includes(user.role)) {
      throw new ForbiddenException('เฉพาะ Admin เท่านั้น');
    }
    const plan = await this.prisma.assignmentPlan.findUnique({
      where: { id: planId },
      include: {
        versions: {
          where: { isCurrent: true },
          include: { items: true },
          take: 1,
        },
      },
    });
    if (!plan) throw new NotFoundException('ไม่พบแผน');
    if (plan.status !== 'approved') {
      throw new BadRequestException('ต้องอนุมัติก่อน Publish');
    }

    const currentVersion = plan.versions[0];
    if (!currentVersion || !currentVersion.items.length) {
      throw new BadRequestException('ยังไม่มี assignment items');
    }

    const items = currentVersion.items;
    const agencyIds = [...new Set(items.map((i) => i.agencyId))];

    // ─── คำนวณวันทำการในเดือนนั้น ──────────────────────────────────────────
    const [yearStr, monthStr] = plan.period.split('-');
    const y = Number(yearStr);
    const m = Number(monthStr); // 1-indexed
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const workingDays: Date[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dow = dt.getUTCDay(); // 0=Sun, 6=Sat
      if (dow !== 0 && dow !== 6) workingDays.push(dt);
    }
    if (workingDays.length === 0) workingDays.push(new Date(Date.UTC(y, m - 1, 1)));

    // กระจาย agency ให้แต่ละเซลส์ round-robin ตามวันทำการ
    const autoNote = `[AssignmentPlan:${planId}]`;
    const empDayIdx = new Map<string, number>();
    const visitPlanData = items.map((item) => {
      const idx = empDayIdx.get(item.employeeId) ?? 0;
      empDayIdx.set(item.employeeId, idx + 1);
      return {
        id: randomUUID(),
        agencyId: item.agencyId,
        employeeId: item.employeeId,
        planDate: workingDays[idx % workingDays.length],
        status: VisitStatus.pending,
        priority: 'medium',
        note: autoNote,
      };
    });

    await this.prisma.$transaction(async (tx) => {
      // ปิด assignment เดิมของ agency เหล่านี้
      await tx.agencyAssignment.updateMany({
        where: { agencyId: { in: agencyIds } },
        data: { isActive: false },
      });
      // สร้างคู่ใหม่
      await tx.agencyAssignment.createMany({
        data: items.map((i) => ({
          id: randomUUID(),
          agencyId: i.agencyId,
          employeeId: i.employeeId,
          isActive: true,
        })),
        skipDuplicates: true,
      });
      // เปิดใช้คู่เป้าหมาย group by employee
      const byEmp = new Map<string, string[]>();
      for (const i of items) {
        const arr = byEmp.get(i.employeeId) ?? [];
        arr.push(i.agencyId);
        byEmp.set(i.employeeId, arr);
      }
      for (const [employeeId, ids] of byEmp) {
        await tx.agencyAssignment.updateMany({
          where: { employeeId, agencyId: { in: ids } },
          data: { isActive: true, assignedAt: new Date() },
        });
      }

      // ลบ VisitPlan เก่าที่ auto-gen จากแผนนี้ (กรณี re-publish)
      await tx.visitPlan.deleteMany({
        where: { note: { contains: autoNote }, status: 'pending' },
      });
      // สร้าง VisitPlan ใหม่จากแผน
      if (visitPlanData.length > 0) {
        await tx.visitPlan.createMany({ data: visitPlanData });
      }

      // update plan status
      await tx.assignmentPlan.update({
        where: { id: planId },
        data: { status: 'published', publishedAt: new Date() },
      });
    });

    return { published: true, applied: items.length, visitPlansCreated: visitPlanData.length };
  }

  // ─── Rollback ไป version เก่า (สร้าง version ใหม่จาก version นั้น) ──────
  async rollback(user: RequestUser, planId: string, targetVersionId: string) {
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('ไม่พบแผน');
    if (['published', 'active', 'closed'].includes(plan.status)) {
      throw new ForbiddenException('ไม่สามารถ Rollback แผนที่ Published แล้ว');
    }

    const targetVersion = await this.prisma.planVersion.findFirst({
      where: { id: targetVersionId, planId },
      include: { items: true },
    });
    if (!targetVersion) throw new NotFoundException('ไม่พบ version');

    const currentVersion = await this.prisma.planVersion.findFirst({
      where: { planId, isCurrent: true },
    });
    const nextVersionNo = (currentVersion?.versionNo ?? 0) + 1;
    const newVersionId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      if (currentVersion) {
        await tx.planVersion.update({ where: { id: currentVersion.id }, data: { isCurrent: false } });
      }
      await tx.planVersion.create({
        data: {
          id: newVersionId,
          planId,
          versionNo: nextVersionNo,
          note: `Rollback มาจาก v${targetVersion.versionNo}`,
          isCurrent: true,
          createdById: user.id,
          items: {
            createMany: {
              data: targetVersion.items.map((i) => ({
                id: randomUUID(),
                agencyId: i.agencyId,
                employeeId: i.employeeId,
                isLocked: i.isLocked,
                note: i.note,
              })),
            },
          },
        },
      });
      await tx.assignmentPlan.update({
        where: { id: planId },
        data: { status: 'draft' },
      });
    });

    return this.getById(user, planId);
  }

  // ─── ลบแผน ────────────────────────────────────────────────────────────────
  async delete(user: RequestUser, planId: string) {
    if (!['admin', 'super_admin'].includes(user.role)) {
      throw new ForbiddenException('เฉพาะ Admin เท่านั้น');
    }
    const plan = await this.prisma.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('ไม่พบแผน');

    // ลบได้เฉพาะแผน Draft เท่านั้น
    if (plan.status !== 'draft') {
      throw new BadRequestException('ลบได้เฉพาะแผน Draft เท่านั้น (สถานะ: ' + plan.status + ')');
    }

    // ลบทั้งหมด: versions, items, plan
    await this.prisma.$transaction(async (tx) => {
      // ลบ items ในทุก version
      const versions = await tx.planVersion.findMany({ where: { planId } });
      for (const v of versions) {
        await tx.planVersionItem.deleteMany({ where: { versionId: v.id } });
      }
      // ลบ versions
      await tx.planVersion.deleteMany({ where: { planId } });
      // ลบ plan
      await tx.assignmentPlan.delete({ where: { id: planId } });
    });

    return { message: 'ลบแผนเสร็จสิ้น', id: planId };
  }
}
