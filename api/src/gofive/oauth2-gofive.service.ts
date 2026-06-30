import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoFiveAuthService {
  private readonly clientId = this.configService.get('GOFIVE_CLIENT_ID');
  private readonly clientSecret = this.configService.get('GOFIVE_CLIENT_SECRET');
  private readonly subscriptionKey = this.configService.get('GOFIVE_SUBSCRIPTION_KEY');
  private readonly baseUrl = 'https://api.gofive.co.th';

  constructor(private configService: ConfigService) {}

  async getAuthorizationUrl(): Promise<string> {
    return `${this.baseUrl}/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=http://localhost:3000/callback`;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return {
      accessToken: 'token_' + code,
      refreshToken: 'refresh_' + code,
      expiresIn: 3600,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    return {
      accessToken: 'new_token_' + Date.now(),
      expiresIn: 3600,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    return accessToken.length > 0;
  }
}
