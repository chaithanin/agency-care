import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // เพิ่ม body limit + เก็บ rawBody ไว้ verify LINE webhook signature
  app.use(json({ limit: '10mb', verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // อยู่หลัง reverse proxy (Railway) -> ใช้ X-Forwarded-For เป็น client IP จริง
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // SPA fallback: ส่ง index.html สำหรับ client route (ไม่ใช่ /api และไม่ใช่ไฟล์ static)
  const indexHtml = join(__dirname, '..', 'public', 'index.html');
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
      return res.sendFile(indexHtml, (err: unknown) => err && next());
    }
    next();
  });

  const port = Number(process.env.PORT) || config.get<number>('API_PORT', 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 Agency Care API running on port ${port}`);
}
bootstrap();
