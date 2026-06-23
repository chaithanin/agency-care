import { Body, Controller, Get, Ip, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { Public, Roles } from './guards';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // login เข้มกว่า: 10 ครั้ง/นาที ต่อ IP
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  @Patch('switch-role')
  switchRole(@CurrentUser('id') userId: string, @Body('role') role: string) {
    return this.auth.switchRole(userId, role);
  }

  @Post('impersonate/:targetId')
  @Roles('admin', 'super_admin')
  impersonate(@CurrentUser('id') adminId: string, @Param('targetId') targetId: string) {
    return this.auth.impersonate(adminId, targetId);
  }
}
