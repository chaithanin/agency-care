import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GoFiveAuthService {
  private readonly clientId = this.configService.get('GOFIVE_CLIENT_ID');
  private readonly clientSecret = this.configService.get('GOFIVE_CLIENT_SECRET');
  private readonly subscriptionKey = this.configService.get('GOFIVE_SUBSCRIPTION_KEY');
  private readonly baseUrl = 'https://api.gofive.co.th';

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async getAuthorizationUrl(): Promise<string> {
    return `${this.baseUrl}/oauth/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=http://localhost:3000/callback`;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const response = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );

    const data = (response as any).data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/oauth/token`, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    );

    const data = (response as any).data;
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/oauth/validate`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
