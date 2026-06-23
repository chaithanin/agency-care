import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;       // permanent role (for permission guards)
  activeRole: UserRole; // current active role (for data scoping)
  additionalRoles: string[];
  isImpersonated: boolean;
  impersonatorId?: string;
  impersonatorName?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    return data ? user?.[data] : user;
  },
);
