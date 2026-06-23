import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  activeRole: UserRole;
  additionalRoles: string[];
  // impersonation fields (only present in impersonation tokens)
  isImpersonated?: boolean;
  impersonatorId?: string;
  impersonatorName?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET', 'change-me-access-secret'),
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      activeRole: payload.activeRole ?? payload.role,
      additionalRoles: payload.additionalRoles ?? [],
      isImpersonated: payload.isImpersonated ?? false,
      impersonatorId: payload.impersonatorId,
      impersonatorName: payload.impersonatorName,
    };
  }
}
