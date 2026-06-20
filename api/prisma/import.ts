// นำเข้าข้อมูลจริงจาก Final Agency List.xlsx
// (แปลงเป็น prisma/data/agencies.json ด้วย scripts/xlsx_extract.py ก่อน)
// รัน: pnpm --filter ./api exec ts-node prisma/import.ts
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Row {
  sales: string;
  name: string;
  mobile: string;
  telephone: string;
  email: string;
  group: string;
  classification: string;
  source: string;
  advertise: string;
  tags: string;
  gradeQuality: string;
  gradeRelationship: string;
  lastVisit: string | null;
  sold: string | null;
  priority: string;
}

// เดาโซน/พื้นที่จากข้อความ
function deriveZone(...texts: string[]): string | undefined {
  const t = texts.join(' ').toLowerCase();
  if (t.includes('pattaya')) return 'พัทยา/ชลบุรี';
  if (t.includes('bangkok')) return 'กรุงเทพ';
  if (t.includes('phuket')) return 'ภูเก็ต';
  if (t.includes('oversea') || t.includes('not in pattaya')) return 'ต่างประเทศ/อื่นๆ';
  return undefined;
}

const clean = (s: string) => (s && s.trim() ? s.trim() : undefined);
const cleanEmail = (s: string) => (s && s.includes('@') ? s.trim() : undefined);

async function main() {
  const file = path.join(__dirname, 'data', 'agencies.json');
  if (!fs.existsSync(file)) {
    throw new Error(`ไม่พบ ${file} — รัน py scripts/xlsx_extract.py ก่อน`);
  }
  const rows: Row[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log(`📄 อ่าน ${rows.length} แถวจาก agencies.json`);

  // ===== 1) เซลส์ (จากชื่อ sheet) + บัญชี login =====
  const salesNames = [...new Set(rows.map((r) => r.sales))];
  const empByName = new Map<string, string>(); // sales name -> employee id
  for (const name of salesNames) {
    const email = `${name.toLowerCase()}@agencycare.local`;
    const passwordHash = await argon2.hash('Agency@1234');
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, name, role: 'sales' },
    });
    const emp = await prisma.employee.upsert({
      where: { code: `SALE-${name.toUpperCase()}` },
      update: { userId: user.id, name },
      create: { code: `SALE-${name.toUpperCase()}`, name, userId: user.id },
    });
    empByName.set(name, emp.id);
    console.log(`👤 เซลส์: ${name} (${email} / Agency@1234)`);
  }

  // ===== 2) Agency + assignment =====
  let i = 0;
  let assigned = 0;
  for (const r of rows) {
    i++;
    const code = `AGC-${String(i).padStart(4, '0')}`;
    const zone = deriveZone(r.classification, r.group, r.name);
    const agency = await prisma.agency.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: r.name,
        type: clean(r.group),
        zone,
        phone: clean(r.mobile) || clean(r.telephone),
        email: cleanEmail(r.email),
        classification: clean(r.classification),
        gradeQuality: clean(r.gradeQuality),
        gradeRelationship: clean(r.gradeRelationship),
        priority: clean(r.priority),
        source: clean(r.source),
        tags: clean(r.tags),
        lastVisitAt: r.lastVisit ? new Date(r.lastVisit) : undefined,
      },
    });

    const empId = empByName.get(r.sales);
    if (empId) {
      await prisma.agencyAssignment.upsert({
        where: { agencyId_employeeId: { agencyId: agency.id, employeeId: empId } },
        update: { isActive: true },
        create: { agencyId: agency.id, employeeId: empId, isActive: true },
      });
      assigned++;
    }
  }

  const withZone = rows.filter((r) => deriveZone(r.classification, r.group, r.name)).length;
  console.log(`🏢 นำเข้า ${i} agency · มอบหมาย ${assigned} · เดาโซนได้ ${withZone}`);
  console.log('⚠️  ทุก agency ยังไม่มีพิกัด GPS — ต้องเติมก่อนถึงจะ check-in ได้');
  console.log('🎉 import เสร็จ');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
