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

  // เสนอการแบ่ง agency ให้เซลส์ — บาลานซ์ตามโซน + จำนวนงาน
  async propose() {
    const [agencies, employees] = await Promise.all([
      this.prisma.agency.findMany({
        where: { status: 'active' },
        select: { id: true, code: true, name: true, zone: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, zone: true },
      }),
    ]);

    if (employees.length === 0) {
      return { proposal: [], summary: [], note: 'ยังไม่มีเซลส์ในระบบ' };
    }

    const load = new Map<string, number>(employees.map((e) => [e.id, 0]));

    const proposal = agencies.map((a) => {
      // ผู้สมัครที่โซนตรงก่อน ถ้าไม่มีใช้ทุกคน
      const sameZone = a.zone ? employees.filter((e) => e.zone === a.zone) : [];
      const pool = sameZone.length ? sameZone : employees;
      // เลือกคนที่ภาระงานน้อยสุด
      const chosen = pool.reduce((best, e) =>
        (load.get(e.id) ?? 0) < (load.get(best.id) ?? 0) ? e : best,
      );
      load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1);
      return {
        agencyId: a.id,
        agencyCode: a.code,
        agencyName: a.name,
        zone: a.zone,
        employeeId: chosen.id,
        employeeName: chosen.name,
        matchedZone: sameZone.length > 0,
      };
    });

    const summary = employees.map((e) => ({
      employeeId: e.id,
      name: e.name,
      code: e.code,
      count: load.get(e.id) ?? 0,
    }));

    return { proposal, summary: summary.sort((a, b) => b.count - a.count) };
  }

  // ยืนยันการแบ่ง — ปิด assignment เก่าของ agency แล้วตั้งใหม่
  async apply(dto: ApplyAssignmentDto) {
    let applied = 0;
    for (const a of dto.assignments) {
      await this.prisma.$transaction([
        this.prisma.agencyAssignment.updateMany({
          where: { agencyId: a.agencyId, employeeId: { not: a.employeeId } },
          data: { isActive: false },
        }),
        this.prisma.agencyAssignment.upsert({
          where: { agencyId_employeeId: { agencyId: a.agencyId, employeeId: a.employeeId } },
          create: { agencyId: a.agencyId, employeeId: a.employeeId, isActive: true },
          update: { isActive: true, assignedAt: new Date() },
        }),
      ]);
      applied++;
    }
    return { applied };
  }
}
