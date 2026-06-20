import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// วันนี้ (เที่ยงคืน UTC) — ให้ตรงกับ query ของ dashboard/visit list
function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

// สร้าง user (login) แบบ idempotent
async function upsertUser(email: string, password: string, name: string, role: 'admin' | 'manager' | 'sales') {
  const passwordHash = await argon2.hash(password);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name, role },
  });
}

async function main() {
  // ===== 1) admin =====
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
  await upsertUser(adminEmail, adminPass, 'ผู้ดูแลระบบ', 'admin');
  console.log(`✅ admin: ${adminEmail} / ${adminPass}`);

  // ===== 2) เซลส์ 2 คน (มีบัญชี login) =====
  const u1 = await upsertUser('sale1@example.com', 'Sale@1234', 'สมชาย ใจดี', 'sales');
  const u2 = await upsertUser('sale2@example.com', 'Sale@1234', 'สมหญิง ขยัน', 'sales');

  const emp1 = await prisma.employee.upsert({
    where: { code: 'SALE-001' },
    update: { userId: u1.id },
    create: { code: 'SALE-001', name: 'สมชาย ใจดี', phone: '081-111-1111', zone: 'กรุงเทพชั้นใน', userId: u1.id },
  });
  const emp2 = await prisma.employee.upsert({
    where: { code: 'SALE-002' },
    update: { userId: u2.id },
    create: { code: 'SALE-002', name: 'สมหญิง ขยัน', phone: '082-222-2222', zone: 'กรุงเทพรอบนอก', userId: u2.id },
  });
  console.log('✅ เซลส์: sale1@example.com, sale2@example.com / Sale@1234');

  // ===== 3) Agency 5 ร้าน (พิกัดจริงย่านกรุงเทพ) =====
  const agencyData = [
    { code: 'AG-001', name: 'ร้านสยามอิเล็กทรอนิกส์', level: 'A' as const, province: 'กรุงเทพ', zone: 'กรุงเทพชั้นใน', latitude: 13.7459, longitude: 100.534, emp: emp1.id },
    { code: 'AG-002', name: 'ร้านอโศกเทรดดิ้ง', level: 'B' as const, province: 'กรุงเทพ', zone: 'กรุงเทพชั้นใน', latitude: 13.7367, longitude: 100.56, emp: emp1.id },
    { code: 'AG-003', name: 'ร้านลาดพร้าวซัพพลาย', level: 'C' as const, province: 'กรุงเทพ', zone: 'กรุงเทพชั้นใน', latitude: 13.816, longitude: 100.561, emp: emp1.id },
    { code: 'AG-004', name: 'ร้านบางนาดีพอท', level: 'B' as const, province: 'กรุงเทพ', zone: 'กรุงเทพรอบนอก', latitude: 13.668, longitude: 100.605, emp: emp2.id },
    { code: 'AG-005', name: 'ร้านปิ่นเกล้าพลาซ่า', level: 'A' as const, province: 'กรุงเทพ', zone: 'กรุงเทพรอบนอก', latitude: 13.776, longitude: 100.476, emp: emp2.id },
  ];

  const day = todayUtc();
  for (const a of agencyData) {
    const agency = await prisma.agency.upsert({
      where: { code: a.code },
      update: { latitude: a.latitude, longitude: a.longitude },
      create: {
        code: a.code,
        name: a.name,
        level: a.level,
        province: a.province,
        zone: a.zone,
        latitude: a.latitude,
        longitude: a.longitude,
      },
    });

    // มอบหมายให้เซลส์
    await prisma.agencyAssignment.upsert({
      where: { agencyId_employeeId: { agencyId: agency.id, employeeId: a.emp } },
      update: { isActive: true },
      create: { agencyId: agency.id, employeeId: a.emp, isActive: true },
    });

    // แผนเยี่ยมวันนี้ (กันซ้ำ: เช็คก่อนสร้าง)
    const exists = await prisma.visitPlan.findFirst({
      where: { agencyId: agency.id, employeeId: a.emp, planDate: day },
    });
    if (!exists) {
      await prisma.visitPlan.create({
        data: { agencyId: agency.id, employeeId: a.emp, planDate: day, status: 'pending' },
      });
    }
  }
  console.log(`✅ Agency 5 ร้าน + assignment + แผนเยี่ยมวันนี้ (${day.toISOString().slice(0, 10)})`);

  // ===== 4) POSM items (เฟส 2) =====
  const posm = [
    { code: 'POSM-01', name: 'โบรชัวร์', unit: 'แผ่น', stockQty: 500 },
    { code: 'POSM-02', name: 'ใบปลิว', unit: 'แผ่น', stockQty: 1000 },
    { code: 'POSM-03', name: 'ป้ายตั้งโต๊ะ', unit: 'อัน', stockQty: 50 },
    { code: 'POSM-04', name: 'Roll Up', unit: 'อัน', stockQty: 20 },
    { code: 'POSM-05', name: 'Banner', unit: 'ผืน', stockQty: 15 },
  ];
  for (const p of posm) {
    await prisma.posmItem.upsert({
      where: { code: p.code },
      update: { stockQty: p.stockQty },
      create: p,
    });
  }

  // ===== 5) Products (เฟส 2) =====
  const products = [
    { code: 'PRD-01', name: 'เครื่องรุ่น A', price: 12900 },
    { code: 'PRD-02', name: 'เครื่องรุ่น B', price: 8500 },
    { code: 'PRD-03', name: 'อุปกรณ์เสริม', price: 1200 },
  ];
  for (const p of products) {
    await prisma.product.upsert({ where: { code: p.code }, update: { price: p.price }, create: p });
  }
  console.log('✅ POSM 5 รายการ + สินค้า 3 รายการ');

  console.log('🎉 seed เสร็จ — login เป็น sale1@example.com เพื่อทดสอบ check-in/แจกสื่อ/บันทึกขาย');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
