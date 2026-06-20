// อัพเดทข้อมูลใหม่จาก Global Top Group (Venio export) + ลบ mock/ข้อมูลเก่าทั้งหมด
// เตรียมไฟล์: py scripts/extract_venio.py -> prisma/data/agencies-v2.json
// รัน: pnpm --filter ./api exec ts-node prisma/import-v2.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Row {
  code: string;
  name: string;
  type: string | null;
  classification: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  note: string | null;
  zone: string | null;
  lat: number | null;
  lng: number | null;
}

async function main() {
  const file = path.join(__dirname, 'data', 'agencies-v2.json');
  if (!fs.existsSync(file)) throw new Error(`ไม่พบ ${file} — รัน py scripts/extract_venio.py ก่อน`);
  const rows: Row[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log(`📄 อ่าน ${rows.length} ราย จาก agencies-v2.json`);

  // ===== 1) ลบข้อมูลเก่าทั้งหมด (mock + 144 เก่า) เหลือแค่ admin =====
  console.log('🧹 ลบข้อมูลเก่า (เรียงตาม FK)...');
  await prisma.auditLog.deleteMany();
  await prisma.modelTransaction.deleteMany();
  await prisma.salesActivity.deleteMany();
  await prisma.posmTransaction.deleteMany();
  await prisma.visitPhoto.deleteMany();
  await prisma.visitCheckin.deleteMany();
  await prisma.visitReport.deleteMany();
  await prisma.visitPlan.deleteMany();
  await prisma.agencyAssignment.deleteMany();
  await prisma.model.deleteMany();
  await prisma.agency.deleteMany();
  await prisma.posmItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.employee.deleteMany();
  const delUsers = await prisma.user.deleteMany({ where: { role: { not: 'admin' } } });
  console.log(`   ลบ agency/visit/master/demo + ${delUsers.count} user (เซลส์ demo) แล้ว`);

  // ===== 2) import agency ใหม่ (createMany) =====
  const clean = (s: string | null) => (s && s.trim() ? s.trim() : undefined);
  const data = rows.map((r) => ({
    code: r.code,
    name: r.name,
    type: clean(r.type),
    zone: clean(r.zone),
    phone: clean(r.phone),
    email: r.email && r.email.includes('@') ? r.email.trim() : undefined,
    classification: clean(r.classification),
    source: clean(r.source),
    tags: clean(r.note), // เก็บ note จาก CRM ไว้ใน tags
    latitude: r.lat ?? undefined,
    longitude: r.lng ?? undefined,
    geocodeSource: r.lat ? 'venio' : undefined, // พิกัดจาก Venio CRM
  }));

  const res = await prisma.agency.createMany({ data, skipDuplicates: true });
  const withGps = data.filter((d) => d.latitude != null).length;
  console.log(`🏢 นำเข้า ${res.count} agency · มีพิกัด GPS ${withGps} (${rows.length - withGps} ยังไม่มี → ใช้ปุ่ม Geocode)`);
  console.log('ℹ️  ยังไม่มอบหมายเซลส์ — ใช้หน้า Auto-Assign หรือมอบหมายเองภายหลัง');
  console.log('🎉 อัพเดทข้อมูลเสร็จ');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
