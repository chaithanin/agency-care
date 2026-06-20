import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import { extname, join } from 'path';

export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

// เก็บไฟล์ที่อัปโหลด: ใช้ GCS ถ้าตั้ง GCS_BUCKET (production/Cloud Run),
// ไม่งั้น fallback เป็น local disk (dev)
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket?: string;
  private readonly storage?: Storage;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>('GCS_BUCKET');
    if (this.bucket) {
      // บน Cloud Run ใช้ Application Default Credentials อัตโนมัติ (ไม่ต้องใส่ key)
      this.storage = new Storage();
      this.logger.log(`เก็บไฟล์บน GCS bucket: ${this.bucket}`);
    } else {
      this.logger.log('ไม่ได้ตั้ง GCS_BUCKET — เก็บไฟล์ใน local disk (dev)');
    }
  }

  // คืน url ที่ใช้แสดงรูปได้
  async save(file: UploadFile, prefix = 'uploads'): Promise<string> {
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${extname(file.originalname)}`;
    const objectPath = `${prefix}/${name}`;

    if (this.storage && this.bucket) {
      await this.storage
        .bucket(this.bucket)
        .file(objectPath)
        .save(file.buffer, { contentType: file.mimetype, resumable: false });
      // ต้องตั้ง bucket ให้ public-read ครั้งเดียว (ดู README/คำสั่ง deploy)
      return `https://storage.googleapis.com/${this.bucket}/${objectPath}`;
    }

    // local fallback
    const dir = this.config.get<string>('UPLOAD_DIR', 'uploads');
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(join(dir, name), file.buffer);
    return `/uploads/${name}`;
  }
}
