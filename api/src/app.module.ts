import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { EmployeeModule } from './employee/employee.module';
import { AgencyModule } from './agency/agency.module';
import { AssignmentModule } from './assignment/assignment.module';
import { VisitModule } from './visit/visit.module';
import { PosmModule } from './posm/posm.module';
import { ProductModule } from './product/product.module';
import { SalesModule } from './sales/sales.module';
import { KpiModule } from './kpi/kpi.module';
import { NotificationModule } from './notification/notification.module';
import { ModelModule } from './model/model.module';
import { RouteModule } from './route/route.module';
import { AutoAssignModule } from './autoassign/autoassign.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // rate limit: 100 req/นาที ต่อ IP (login เข้มกว่าใน controller)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    // เสิร์ฟรูปที่อัปโหลด (check-in photos) ที่ /uploads
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
      serveRoot: '/uploads',
    }),
    // เสิร์ฟ web build (production) จากโฟลเดอร์ public — ยกเว้น /api
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api*'],
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    EmployeeModule,
    AgencyModule,
    AssignmentModule,
    VisitModule,
    PosmModule,
    ProductModule,
    SalesModule,
    KpiModule,
    NotificationModule,
    ModelModule,
    RouteModule,
    AutoAssignModule,
    AnalyticsModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
