import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

@Injectable()
export class AgencyService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  list(params: { zone?: string; status?: string; q?: string }) {
    const where: Prisma.AgencyWhereInput = {};
    if (params.zone) where.zone = params.zone;
    if (params.status === 'active' || params.status === 'inactive') where.status = params.status;
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { code: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.agency.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        assignments: {
          where: { isActive: true },
          include: { employee: { select: { id: true, name: true, code: true } } },
        },
      },
    });
  }

  async get(id: string) {
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { isActive: true },
          include: { employee: { select: { id: true, name: true, code: true } } },
        },
      },
    });
    if (!agency) throw new NotFoundException('ไม่พบ Agency');
    return agency;
  }

  // Phase 7: สรุป pipeline (จำนวนต่อ stage + tier)
  async pipelineStats() {
    const [byStage, byTier, total] = await Promise.all([
      this.prisma.agency.groupBy({ by: ['pipelineStage'], where: { status: 'active' }, _count: { _all: true } }),
      this.prisma.agency.groupBy({ by: ['tier'], where: { status: 'active' }, _count: { _all: true } }),
      this.prisma.agency.count({ where: { status: 'active' } }),
    ]);
    return {
      total,
      stages: Object.fromEntries(byStage.map((s) => [s.pipelineStage, s._count._all])),
      tiers: Object.fromEntries(byTier.map((t) => [t.tier, t._count._all])),
    };
  }

  // ตรวจ duplicate ก่อนสร้าง — คืน array ของรายการที่น่าสงสัย
  async checkDuplicate(params: { name?: string; phone?: string; code?: string }) {
    const conditions: any[] = [];
    if (params.code) conditions.push({ code: { equals: params.code, mode: 'insensitive' } });
    if (params.phone) conditions.push({ phone: params.phone });
    if (params.name) {
      // ตัดคำสั้นมาก (น้อยกว่า 4 ตัว) ออก
      const trimmed = params.name.trim();
      if (trimmed.length >= 4) {
        conditions.push({ name: { contains: trimmed.slice(0, 20), mode: 'insensitive' } });
      }
    }
    if (!conditions.length) return { duplicates: [] };
    const hits = await this.prisma.agency.findMany({
      where: { OR: conditions },
      select: { id: true, code: true, name: true, phone: true, province: true, status: true },
      take: 5,
    });
    return { duplicates: hits };
  }

  async create(dto: CreateAgencyDto) {
    const dup = await this.prisma.agency.findUnique({ where: { code: dto.code } });
    if (dup) throw new BadRequestException(`รหัส Agency ${dto.code} ถูกใช้แล้ว`);
    return this.prisma.agency.create({ data: dto });
  }

  async update(id: string, dto: UpdateAgencyDto) {
    await this.get(id);
    // ตั้งพิกัดเอง = ยืนยันแล้ว (manual)
    const data: Prisma.AgencyUpdateInput = { ...dto };
    if (dto.latitude != null && dto.longitude != null) data.geocodeSource = 'manual';
    return this.prisma.agency.update({ where: { id }, data });
  }

  // เติมพิกัดอัตโนมัติให้ agency ที่ยังไม่มี ผ่าน Google Geocoding API
  async geocodeMissing(limit = 50) {
    const key = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!key) {
      throw new BadRequestException('ยังไม่ได้ตั้ง GOOGLE_MAPS_API_KEY ใน .env');
    }
    const targets = await this.prisma.agency.findMany({
      where: { latitude: null },
      take: limit,
      orderBy: { code: 'asc' },
    });

    let found = 0;
    const failedNames: string[] = [];
    for (const a of targets) {
      const address = encodeURIComponent(`${a.name} ${a.zone ?? 'Pattaya'} Thailand`);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${address}&region=th&language=th&key=${key}`;
      try {
        const res = await fetch(url);
        const data = (await res.json()) as {
          results?: { geometry?: { location?: { lat: number; lng: number } } }[];
        };
        const loc = data.results?.[0]?.geometry?.location;
        if (loc?.lat && loc?.lng) {
          await this.prisma.agency.update({
            where: { id: a.id },
            data: { latitude: loc.lat, longitude: loc.lng, geocodeSource: 'google' },
          });
          found++;
        } else {
          failedNames.push(a.name);
        }
      } catch {
        failedNames.push(a.name);
      }
      // กัน rate limit
      await new Promise((r) => setTimeout(r, 120));
    }

    const remaining = await this.prisma.agency.count({ where: { latitude: null } });
    return {
      processed: targets.length,
      found,
      failed: failedNames.length,
      failedNames: failedNames.slice(0, 20),
      remaining,
      note: 'พิกัด auto (google) ควรตรวจความถูกต้องก่อนใช้ check-in',
    };
  }
}
