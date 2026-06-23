import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      activeRole: user.activeRole,
      additionalRoles: user.additionalRoles,
    });

    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'login', entity: 'user', entityId: user.id, ip },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        activeRole: user.activeRole,
        additionalRoles: user.additionalRoles,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();
      return this.issueTokens({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        activeRole: user.activeRole, // re-fetched from DB
        additionalRoles: user.additionalRoles,
      });
    } catch {
      throw new UnauthorizedException('refresh token ไม่ถูกต้องหรือหมดอายุ');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        activeRole: true,
        additionalRoles: true,
        employee: { select: { id: true, code: true, zone: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async switchRole(userId: string, newRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const allowed = [user.role as string, ...user.additionalRoles];
    if (!allowed.includes(newRole)) {
      throw new ForbiddenException('ไม่มีสิทธิ์ role นี้');
    }

    const activeRole = newRole as UserRole;
    await this.prisma.user.update({ where: { id: userId }, data: { activeRole } });

    return this.issueTokens({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      activeRole,
      additionalRoles: user.additionalRoles,
    });
  }

  async impersonate(adminId: string, targetId: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminId } });
    if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
      throw new ForbiddenException('เฉพาะ Admin เท่านั้น');
    }
    if (adminId === targetId) {
      throw new ForbiddenException('ไม่สามารถ Impersonate ตัวเองได้');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true, email: true, name: true, role: true,
        activeRole: true, additionalRoles: true, isActive: true,
      },
    });
    if (!target || !target.isActive) throw new NotFoundException('ไม่พบผู้ใช้');

    const impersonateToken = await this.jwt.signAsync(
      {
        sub: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
        activeRole: target.activeRole,
        additionalRoles: [],
        isImpersonated: true,
        impersonatorId: admin.id,
        impersonatorName: admin.name,
      } as JwtPayload,
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '2h',
      },
    );

    await this.prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'impersonate',
        entity: 'user',
        entityId: target.id,
      },
    });

    return {
      impersonateToken,
      targetName: target.name,
      targetRole: target.role,
    };
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '7d'),
    });
    return { accessToken, refreshToken };
  }
}
