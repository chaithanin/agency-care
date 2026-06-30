import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GoFiveApiClient {
  private readonly baseUrl = 'https://api.gofive.co.th';
  private accessToken: string;

  constructor(private httpService: HttpService) {}

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getCustomers(skip: number = 0, take: number = 50) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/customers`, {
        headers: this.getHeaders(),
        params: { skip, take },
      }),
    );
    return response.data;
  }

  async getCustomerById(customerId: string) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/customers/${customerId}`, {
        headers: this.getHeaders(),
      }),
    );
    return response.data;
  }

  async getProducts(skip: number = 0, take: number = 50) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/products`, {
        headers: this.getHeaders(),
        params: { skip, take },
      }),
    );
    return response.data;
  }

  async getOrders(customerId?: string) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/orders`, {
        headers: this.getHeaders(),
        params: customerId ? { customerId } : {},
      }),
    );
    return response.data;
  }

  async getAppointments(startDate: string, endDate: string) {
    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/api/appointments`, {
        headers: this.getHeaders(),
        params: { startDate, endDate },
      }),
    );
    return response.data;
  }
}
