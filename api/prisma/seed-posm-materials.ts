/**
 * seed-posm-materials.ts
 * Seed the 15 real marketing materials from the Excel inventory file.
 * Run: npx ts-node prisma/seed-posm-materials.ts
 *
 * Safe to run multiple times — uses upsert on code.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MATERIALS = [
  // Display
  { code: 'MAT-DSP-001', name: 'X-Stand',        category: 'display',  unit: 'อัน',  stockQty: 20,  reorderPoint: 5,  description: 'X-Stand display banner for agency office' },
  { code: 'MAT-DSP-002', name: 'Picture Frame',   category: 'display',  unit: 'อัน',  stockQty: 20,  reorderPoint: 5,  description: 'Picture frame for project display' },
  { code: 'MAT-DSP-003', name: 'Stand Brochure',  category: 'display',  unit: 'อัน',  stockQty: 20,  reorderPoint: 5,  description: 'Brochure stand display rack' },

  // Printed Materials
  { code: 'MAT-PRT-001', name: 'Map (All Projects)',  category: 'printed', unit: 'แผ่น', stockQty: 300, reorderPoint: 50, description: 'Location map covering all projects' },
  { code: 'MAT-PRT-002', name: 'Flyer English',       category: 'printed', unit: 'แผ่น', stockQty: 500, reorderPoint: 100, description: 'English language project flyer' },
  { code: 'MAT-PRT-003', name: 'Flyer Chinese',       category: 'printed', unit: 'แผ่น', stockQty: 500, reorderPoint: 100, description: 'Chinese language project flyer' },
  { code: 'MAT-PRT-004', name: 'Flyer Russian',       category: 'printed', unit: 'แผ่น', stockQty: 500, reorderPoint: 100, description: 'Russian language project flyer' },
  { code: 'MAT-PRT-005', name: 'Brochures',           category: 'printed', unit: 'เล่ม', stockQty: 200, reorderPoint: 30, description: 'Full project brochure' },
  { code: 'MAT-PRT-006', name: 'Price Lists',         category: 'printed', unit: 'ชุด',  stockQty: 100, reorderPoint: 20, description: 'Current price list document' },
  { code: 'MAT-PRT-007', name: 'Business Cards',      category: 'printed', unit: 'ใบ',   stockQty: 500, reorderPoint: 100, description: 'Sales team business cards' },
  { code: 'MAT-PRT-008', name: 'Sales Kits',          category: 'printed', unit: 'ชุด',  stockQty: 50,  reorderPoint: 10, description: 'Complete sales kit package' },
  { code: 'MAT-PRT-009', name: 'GTG Magazine',        category: 'printed', unit: 'เล่ม', stockQty: 200, reorderPoint: 30, description: 'GTG company magazine' },

  // Gifts
  { code: 'MAT-GFT-001', name: 'Gift: Heart (Love It)', category: 'gift', unit: 'ชิ้น', stockQty: 50, reorderPoint: 10, description: 'Heart-shaped branded gift item' },
  { code: 'MAT-GFT-002', name: 'Gift: Coffee Cup',      category: 'gift', unit: 'ใบ',   stockQty: 50, reorderPoint: 10, description: 'Branded coffee cup gift' },
  { code: 'MAT-GFT-003', name: 'Gift: Cookies',         category: 'gift', unit: 'กล่อง', stockQty: 30, reorderPoint: 5,  description: 'Branded cookies gift box' },
];

async function main() {
  console.log('Seeding 15 marketing materials...');
  for (const m of MATERIALS) {
    await prisma.posmItem.upsert({
      where: { code: m.code },
      create: m,
      update: { name: m.name, category: m.category, description: m.description, unit: m.unit },
    });
    console.log(`  ✓ ${m.code} — ${m.name}`);
  }
  console.log(`Done! ${MATERIALS.length} materials seeded.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
