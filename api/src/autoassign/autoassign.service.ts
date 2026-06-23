import { Injectable } from '@nestjs/common';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';

class AssignPair {
  @IsString()
  agencyId!: string;

  @IsString()
  employeeId!: string;
}

export class ApplyAssignmentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignPair)
  assignments!: AssignPair[];
}

@Injectable()
export class AutoAssignService {
  constructor(private prisma: PrismaService) {}

  // เสนอการแบ่ง agency — เฉพาะ Sales (ไม่รวม Closer), จำกัด maxPerSales/คน (Phase 5: 30)
  async propose(maxPerSales?: number) {
    const cap = maxPerSales && maxPerSales > 0 ? maxPerSales : undefined;
    const [agencies, employees] = await Promise.all([
      this.prisma.agency.findMany({
        where: { status: 'active' },
        select: { id: true, code: true, name: true, zone: true },
        orderBy: { code: 'asc' },
      }),
      // Phase 5: แบ่งให้เฉพาะ Sales เท่านั้น (Closer ไม่ถือร้าน)
      this.prisma.employee.findMany({
        where: { isActive: true, position: 'sales' },
        select: { id: true, name: true, code: true, zone: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    if (employees.length === 0) {
      return { proposal: [], summary: [], unassignedAgencies: [], note: 'ยังไม่มีเซลส์ (Sales) ในระบบ' };
    }

    const load = new Map<string, number>(employees.map((e) => [e.id, 0]));
    const hasRoom = (e: { id: string }) => cap === undefined || (load.get(e.id) ?? 0) < cap;
    const unassignedAgencies: { id: string; code: string; name: string; zone?: string | null }[] = [];

    const proposal = agencies.map((a) => {
      // ผู้สมัครที่โซนตรง (ยังไม่เต็ม) ก่อน ถ้าไม่มีใช้ทุกคนที่ยังไม่เต็ม
      const sameZone = a.zone ? employees.filter((e) => e.zone === a.zone && hasRoom(e)) : [];
      const pool = sameZone.length ? sameZone : employees.filter(hasRoom);
      if (pool.length === 0) {
        // เต็มทุกคนแล้ว — เกินโควต้า เหลือไว้ไม่มอบหมาย
        unassignedAgencies.push({ id: a.id, code: a.code, name: a.name, zone: a.zone });
        return {
          agencyId: a.id, agencyCode: a.code, agencyName: a.name, zone: a.zone,
          employeeId: '', employeeName: '— ยังไม่มอบหมาย (เกินโควต้า) —', matchedZone: false,
        };
      }
      const chosen = pool.reduce((best, e) => ((load.get(e.id) ?? 0) < (load.get(best.id) ?? 0) ? e : best));
      load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1);
      return {
        agencyId: a.id, agencyCode: a.code, agencyName: a.name, zone: a.zone,
        employeeId: chosen.id, employeeName: chosen.name, matchedZone: sameZone.length > 0,
      };
    });

    const summary = employees.map((e) => ({
      employeeId: e.id, name: e.name, code: e.code, count: load.get(e.id) ?? 0,
    }));

    return {
      proposal,
      summary: summary.sort((a, b) => b.count - a.count),
      cap: cap ?? null,
      unassignedAgencies,
      note:
        unassignedAgencies.length > 0
          ? `แบ่งครบโควต้า ${cap}/คน แล้ว — เหลือ ${unassignedAgencies.length} ร้านไม่ได้มอบหมาย (เพิ่มเซลส์หรือเพิ่มโควต้า)`
          : undefined,
    };
  }

  // ยืนยันการแบ่ง — bulk (เลี่ยง loop รายตัวที่ช้า/timeout กับข้อมูลจำนวนมาก)
  async apply(dto: ApplyAssignmentDto) {
    const pairs = (dto.assignments ?? []).filter((p) => p.employeeId); // ข้ามร้านที่ไม่มอบหมาย
    if (!pairs.length) return { applied: 0 };
    const agencyIds = [...new Set(pairs.map((p) => p.agencyId))];

    // 1) ปิด assignment เดิมของ agency เหล่านี้ทั้งหมด
    await this.prisma.agencyAssignment.updateMany({
      where: { agencyId: { in: agencyIds } },
      data: { isActive: false },
    });
    // 2) สร้างคู่ใหม่ที่ยังไม่มี (คู่ที่มีอยู่จะข้าม)
    await this.prisma.agencyAssignment.createMany({
      data: pairs.map((p) => ({ agencyId: p.agencyId, employeeId: p.employeeId, isActive: true })),
      skipDuplicates: true,
    });
    // 3) เปิดใช้คู่เป้าหมาย (รวมคู่ที่มีอยู่เดิม) — group ตามเซลส์ (~จำนวนเซลส์ query)
    const byEmp = new Map<string, string[]>();
    for (const p of pairs) {
      const arr = byEmp.get(p.employeeId) ?? [];
      arr.push(p.agencyId);
      byEmp.set(p.employeeId, arr);
    }
    for (const [employeeId, ids] of byEmp) {
      await this.prisma.agencyAssignment.updateMany({
        where: { employeeId, agencyId: { in: ids } },
        data: { isActive: true, assignedAt: new Date() },
      });
    }
    return { applied: pairs.length };
  }
}
