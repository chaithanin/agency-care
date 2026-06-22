// Phase 5 — seed mockup: ทีม A/B + เซลส์ 6 + Closer 4 + ปฏิทินทำงานเดือนนี้
// + มอบหมาย agency ให้เซลส์ (round-robin ตามโซน) + แผนเดือน
// รัน: pnpm --filter ./api exec ts-node prisma/seed-phase5.ts
import { PrismaClient, EmployeePosition } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ===== mockup staff (เปลี่ยนเป็นคนจริงทีหลัง) =====
const TEAMS = [
  { code: 'TEAM-A', name: 'ทีม A (พัทยา/ชลบุรี)', zone: 'พัทยา/ชลบุรี' },
  { code: 'TEAM-B', name: 'ทีม B (กรุงเทพ)', zone: 'กรุงเทพ' },
];
const SALES = [
  { code: 'SALE-01', name: 'สมชาย ใจดี', team: 'TEAM-A' },
  { code: 'SALE-02', name: 'สมหญิง รักงาน', team: 'TEAM-A' },
  { code: 'SALE-03', name: 'อนันต์ ขยัน', team: 'TEAM-A' },
  { code: 'SALE-04', name: 'เบนซ์ คล่องแคล่ว', team: 'TEAM-B' },
  { code: 'SALE-05', name: 'ชัย มุ่งมั่น', team: 'TEAM-B' },
  { code: 'SALE-06', name: 'ดาว สดใส', team: 'TEAM-B' },
];
const CLOSERS = [
  { code: 'CLOSER-01', name: 'เอก ปิดดีล', team: 'TEAM-A' },
  { code: 'CLOSER-02', name: 'เต้ย ตามงาน', team: 'TEAM-A' },
  { code: 'CLOSER-03', name: 'มิ้นต์ คุณภาพ', team: 'TEAM-B' },
  { code: 'CLOSER-04', name: 'นัท ดูแล', team: 'TEAM-B' },
];

async function upsertStaff(
  list: { code: string; name: string; team: string }[],
  position: EmployeePosition,
  emailPrefix: string,
  password: string,
  teamId: Map<string, string>,
) {
  const hash = await argon2.hash(password);
  let n = 0;
  for (const s of list) {
    const email = `${emailPrefix}${++n}@agencycare.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name: s.name },
      create: { email, passwordHash: hash, name: s.name, role: 'sales' },
    });
    await prisma.employee.upsert({
      where: { code: s.code },
      update: { name: s.name, position, teamId: teamId.get(s.team), userId: user.id },
      create: { code: s.code, name: s.name, position, teamId: teamId.get(s.team), userId: user.id },
    });
  }
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 1) ทีม
  const teamId = new Map<string, string>();
  for (const t of TEAMS) {
    const team = await prisma.team.upsert({
      where: { code: t.code },
      update: { name: t.name, zone: t.zone },
      create: t,
    });
    teamId.set(t.code, team.id);
  }
  console.log(`✅ ทีม ${TEAMS.length}`);

  // 2) staff
  await upsertStaff(SALES, 'sales', 'sale', 'Sale@1234', teamId);
  await upsertStaff(CLOSERS, 'closer', 'closer', 'Closer@1234', teamId);
  console.log(`✅ เซลส์ ${SALES.length} (sale1-6@agencycare.local / Sale@1234) · Closer ${CLOSERS.length} (closer1-4@ / Closer@1234)`);

  // 3) ปฏิทินทำงานเดือนนี้ — เสาร์/อาทิตย์ = หยุด
  const daysInMonth = new Date(year, month, 0).getDate();
  let holidays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const dow = date.getUTCDay(); // 0=อา 6=เสา
    const isHoliday = dow === 0 || dow === 6;
    if (isHoliday) holidays++;
    await prisma.workCalendar.upsert({
      where: { date },
      update: { isHoliday },
      create: { date, isHoliday, note: isHoliday ? 'วันหยุดสุดสัปดาห์' : null },
    });
  }
  console.log(`✅ ปฏิทิน ${year}-${String(month).padStart(2, '0')}: ทำงาน ${daysInMonth - holidays} วัน หยุด ${holidays}`);

  // 4) มอบหมาย agency ให้เซลส์ (round-robin ตามโซน) + แผนเดือน
  const sales = await prisma.employee.findMany({ where: { position: 'sales' }, include: { team: true } });
  const agencies = await prisma.agency.findMany({ where: { status: 'active' }, select: { id: true, zone: true } });
  // ล้าง assignment เก่า (กรณีรันซ้ำ)
  await prisma.agencyAssignment.deleteMany();
  const counts = new Map<string, number>();
  let i = 0;
  for (const a of agencies) {
    // จับคู่โซนถ้าได้ ไม่งั้น round-robin
    const pool = sales.filter((s) => s.team?.zone === a.zone);
    const emp = (pool.length ? pool : sales)[i % (pool.length || sales.length)];
    i++;
    await prisma.agencyAssignment.create({ data: { agencyId: a.id, employeeId: emp.id, isActive: true } });
    counts.set(emp.id, (counts.get(emp.id) || 0) + 1);
  }
  for (const s of sales) {
    const assigned = counts.get(s.id) || 0;
    await prisma.monthlyPlan.upsert({
      where: { employeeId_year_month: { employeeId: s.id, year, month } },
      update: { visitTarget: assigned * 2, workDayTarget: 24, newAgencyTarget: 2 },
      create: { employeeId: s.id, year, month, visitTarget: assigned * 2, workDayTarget: 24, newAgencyTarget: 2 },
    });
  }
  console.log(`✅ มอบหมาย ${agencies.length} agency ให้เซลส์ ${sales.length} (≈${Math.round(agencies.length / sales.length)}/คน) + แผนเดือน (เป้าเยี่ยม 2x/ร้าน)`);
  console.log('🎉 seed Phase 5 เสร็จ');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
