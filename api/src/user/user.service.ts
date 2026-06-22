import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        employee: { select: { id: true, code: true, name: true } },
      },
    });
  }

  private async getOrThrow(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('ไม่พบผู้ใช้');
    return u;
  }

  async create(dto: CreateUserDto) {
    const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (dup) throw new BadRequestException(`อีเมล ${dto.email} ถูกใช้แล้ว`);
    const passwordHash = await argon2.hash(dto.password);
    const u = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, role: dto.role ?? 'sales', passwordHash },
    });
    return { id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive };
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.getOrThrow(id);
    const u = await this.prisma.user.update({
      where: { id },
      data: { name: dto.name, role: dto.role, isActive: dto.isActive },
    });
    return { id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive };
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    await this.getOrThrow(id);
    const passwordHash = await argon2.hash(dto.password);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }
}
