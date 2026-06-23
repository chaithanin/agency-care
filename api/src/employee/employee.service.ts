import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.employee.findMany({
      orderBy: { code: 'asc' },
      include: {
        user: { select: { email: true, role: true, isActive: true } },
        team: { select: { id: true, name: true } },
        _count: { select: { assignments: true } },
      },
    });
  }

  async get(id: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: { user: { select: { email: true, role: true } } },
    });
    if (!emp) throw new NotFoundException('ไม่พบพนักงาน');
    return emp;
  }

  async create(dto: CreateEmployeeDto) {
    const dup = await this.prisma.employee.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`รหัสพนักงาน ${dto.code} ถูกใช้แล้ว`);

    // สร้างบัญชี login ถ้าให้ email+password มา
    let userId: string | undefined;
    if (dto.email && dto.password) {
      const dupUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dupUser) throw new BadRequestException(`อีเมล ${dto.email} ถูกใช้แล้ว`);
      const passwordHash = await argon2.hash(dto.password);
      const user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash, name: dto.name, role: 'sales' },
      });
      userId = user.id;
    } else if (dto.email || dto.password) {
      throw new BadRequestException('ต้องใส่ทั้งอีเมลและรหัสผ่านเพื่อสร้างบัญชี login');
    }

    return this.prisma.employee.create({
      data: {
        code: dto.code,
        name: dto.name,
        phone: dto.phone,
        zone: dto.zone,
        lineUserId: dto.lineUserId,
        userId,
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const emp = await this.get(id);
    const { email, ...rest } = dto;

    if (email) {
      if (!emp.userId) throw new BadRequestException('พนักงานนี้ยังไม่มีบัญชี login');
      const dup = await this.prisma.user.findFirst({ where: { email, NOT: { id: emp.userId } } });
      if (dup) throw new BadRequestException(`อีเมล ${email} ถูกใช้แล้ว`);
      await this.prisma.user.update({ where: { id: emp.userId }, data: { email } });
    }

    // teamId '' -> null (ไม่สังกัดทีม)
    const data = { ...rest, teamId: dto.teamId === '' ? null : dto.teamId };
    return this.prisma.employee.update({ where: { id }, data });
  }
}
