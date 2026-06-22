// Phase 5 — seed ทีมจริง (3 ทีม) + เซลส์ 7 + Closer 3 + ปฏิทิน + มอบหมาย 30 ร้าน/เซลส์
// รัน: pnpm --filter ./api exec ts-node prisma/seed-phase5.ts
import { PrismaClient, EmployeePosition } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const AGENCIES_PER_SALES = 30;

const TEAMS = [
  { code: 'TEAM-1', name: 'ทีม 1' },
  { code: 'TEAM-2', name: 'ทีม 2' },
  { code: 'TEAM-3', name: 'ทีม 3' },
];
// ทีมจริง — closer 3, sales 7 (3 คนกำลังเทรน)
const STAFF: {
  code: string;
  name: string;
  position: EmployeePosition;
  team: string;
  inTraining?: boolean;
}[] = [
  { code: 'CLOSER-HARRY', name: 'Harry', position: 'closer', team: 'TEAM-1' },
  { code: 'SALE-NICK', name: 'Nick', position: 'sales', team: 'TEAM-1' },
  { code: 'SALE-THOMAS', name: 'Thomas', position: 'sales', team: 'TEAM-1' },
  { code: 'SALE-ICE', name: 'Ice', position: 'sales', team: 'TEAM-1', inTraining: true },
  { code: 'CLOSER-ANNA', name: 'Anna', position: 'closer', team: 'TEAM-2' },
  { code: 'SALE-TAISA', name: 'Taisa', position: 'sales', team: 'TEAM-2' },
  { code: 'SALE-JACK', name: 'Jack', position: 'sales', team: 'TEAM-2', inTraining: true },
  { code: 'CLOSER-DEE', name: 'Dee', position: 'closer', team: 'TEAM-3' },
  { code: 'SALE-CHU', name: 'Chu', position: 'sales', team: 'TEAM-3' },
  { code: 'SALE-KAT', name: 'Kat', position: 'sales', team: 'TEAM-3', inTraining: true },
];

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 1) ทีม
  const teamId = new Map<string, string>();
  for (const t of TEAMS) {
    const team = await prisma.team.upsert({ where: { code: t.code }, update: { name: t.name }, create: t });
    teamId.set(t.code, team.id);
  }
  console.log(`✅ ทีม ${TEAMS.length}`);

  // 2) staff — ลบ employee/user เซลส์ mockup เดิมก่อน (เก็บ admin)
  await prisma.agencyAssignment.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany({ where: { role: { not: 'admin' } } });

  const saleHash = await argon2.hash('Sale@1234');
  const closerHash = await argon2.hash('Closer@1234');
  const empByCode = new Map<string, string>();
  for (const s of STAFF) {
    const email = `${s.name.toLowerCase()}@agencycare.local`;
    const user = await prisma.user.create({
      data: { email, passwordHash: s.position === 'closer' ? closerHash : saleHash, name: s.name, role: 'sales' },
    });
    const emp = await prisma.employee.create({
      data: {
        code: s.code,
        name: s.name,
        position: s.position,
        inTraining: s.inTraining ?? false,
        teamId: teamId.get(s.team),
        userId: user.id,
      },
    });
    empByCode.set(s.code, emp.id);
  }
  const salesList = STAFF.filter((s) => s.position === 'sales');
  console.log(`✅ Closer 3 (harry/anna/dee@agencycare.local / Closer@1234) · Sales ${salesList.length} (nick/thomas/ice/taisa/jack/chu/kat@ / Sale@1234)`);

  // 3) ปฏิทิน — ทำงานทุกวัน (ไม่หยุดเสาร์-อาทิตย์); วันหยุดบริษัทเพิ่มเองภายหลัง,
  //    วันหยุดส่วนตัวตั้งราย user (EmployeeHoliday) เพื่อให้ได้ 24 วันทำงาน/เดือน
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    await prisma.workCalendar.upsert({ where: { date }, update: { isHoliday: false }, create: { date, isHoliday: false } });
  }
  console.log(`✅ ปฏิทิน ${year}-${String(month).padStart(2, '0')}: ทำงานทุกวัน ${daysInMonth} วัน (ไม่หยุดเสาร์-อาทิตย์)`);

  // 4) มอบหมาย 30 ร้าน/เซลส์ (เลือกร้านที่มีพิกัด GPS ก่อน) + แผนเดือน
  const need = salesList.length * AGENCIES_PER_SALES;
  const agencies = await prisma.agency.findMany({
    where: { status: 'active', latitude: { not: null } },
    select: { id: true },
    orderBy: { code: 'asc' },
    take: need,
  });
  let idx = 0;
  for (const s of salesList) {
    const empId = empByCode.get(s.code)!;
    const slice = agencies.slice(idx, idx + AGENCIES_PER_SALES);
    idx += AGENCIES_PER_SALES;
    await prisma.agencyAssignment.createMany({
      data: slice.map((a) => ({ agencyId: a.id, employeeId: empId, isActive: true })),
    });
    await prisma.monthlyPlan.upsert({
      where: { employeeId_year_month: { employeeId: empId, year, month } },
      update: { visitTarget: slice.length * 2, workDayTarget: 24, newAgencyTarget: 2 },
      create: { employeeId: empId, year, month, visitTarget: slice.length * 2, workDayTarget: 24, newAgencyTarget: 2 },
    });
  }
  console.log(`✅ มอบหมาย ${idx} ร้าน (${AGENCIES_PER_SALES}/เซลส์ × ${salesList.length}) + แผนเดือน (เป้าเยี่ยม ${AGENCIES_PER_SALES * 2}/คน)`);
  console.log('🎉 seed Phase 5 (ทีมจริง) เสร็จ');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
