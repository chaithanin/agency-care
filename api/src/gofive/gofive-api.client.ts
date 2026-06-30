import { Injectable } from '@nestjs/common';

@Injectable()
export class GoFiveApiClient {
  private readonly baseUrl = 'https://api.gofive.co.th';
  private accessToken: string = '';

  constructor() {}

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
    // TODO: Implement with actual HTTP client after @nestjs/axios is available
    return [];
  }

  async getCustomerById(customerId: string) {
    return null;
  }

  async getProducts(skip: number = 0, take: number = 50) {
    return [];
  }

  async getOrders(customerId?: string) {
    return [];
  }

  async getAppointments(startDate: string, endDate: string) {
    return [];
  }
}
