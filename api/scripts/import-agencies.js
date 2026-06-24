/**
 * Import Agency data from Venio CRM Excel export
 * Usage: node api/scripts/import-agencies.js <excel-path>
 */

const path = require('path');
// xlsx installed at D:\github\node_modules (api dir uses workspaces — install there)
const XLSX = require(path.join('D:\\github\\node_modules\\xlsx'));
const { PrismaClient } = require('../node_modules/@prisma/client');

const prisma = new PrismaClient();

// ── Field mapping helpers ──────────────────────────────────────────────────

function mapStatus(status) {
  const s = String(status || '').trim();
  return s === 'Active' ? 'active' : 'inactive';
}

function mapPipeline(state) {
  const s = String(state || '').toLowerCase().trim();
  if (s === 'lead') return 'prospect';
  if (s === 'prospect') return 'prospect';
  return 'active'; // Customer → active
}

function mapLevel(gradeQuality) {
  const g = String(gradeQuality || '').trim();
  if (g.startsWith('1')) return 'A';
  if (g.startsWith('2')) return 'B';
  if (g.startsWith('3')) return 'C';
  if (g.startsWith('4')) return 'D';
  return 'C'; // default
}

function cleanPhone(p) {
  const s = String(p || '').trim();
  if (!s) return null;
  return s.replace(/[^0-9+\-\s()]/g, '').substring(0, 30) || null;
}

function cleanStr(v) {
  const s = String(v || '').trim();
  return s || null;
}

function cleanProvince(prov) {
  const s = String(prov || '').trim();
  if (!s) return null;
  // Normalize province names
  const map = {
    'ชลบุรี': 'ชลบุรี', 'Chon Buri': 'ชลบุรี', 'Chang Wat Chon Buri': 'ชลบุรี',
    'กรุงเทพมหานคร': 'กรุงเทพฯ', 'Bangkok': 'กรุงเทพฯ', 'กรุงเทพ': 'กรุงเทพฯ',
    'ระยอง': 'ระยอง', 'Rayong': 'ระยอง',
    'ภูเก็ต': 'ภูเก็ต', 'Phuket': 'ภูเก็ต',
    'เชียงใหม่': 'เชียงใหม่', 'Chiang Mai': 'เชียงใหม่',
    'สมุทรปราการ': 'สมุทรปราการ', 'Samut Prakan': 'สมุทรปราการ',
  };
  return map[s] || s;
}

function inferZone(province, customerGroup) {
  const prov = String(province || '').toLowerCase();
  const grp = String(customerGroup || '').toLowerCase();
  if (prov.includes('ชลบุรี') || prov.includes('chon') || prov.includes('pattaya')) return 'พัทยา';
  if (prov.includes('กรุงเทพ') || prov.includes('bangkok')) return 'กรุงเทพฯ';
  if (prov.includes('ภูเก็ต') || prov.includes('phuket')) return 'ภูเก็ต';
  if (grp.includes('oversea') || grp.includes('online')) return 'Oversea';
  return null;
}

// ── Main import ────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2] || 'C:\\Users\\MANAGER-IT\\Downloads\\Global Top Group_16-06-2026.xlsx';
  console.log('Reading:', filePath);

  const wb = XLSX.readFile(filePath);

  // Load all sheets
  const customers = XLSX.utils.sheet_to_json(wb.Sheets['Customers-Venio-V2'], { defval: '' });
  const contacts  = XLSX.utils.sheet_to_json(wb.Sheets['Contacts-Venio-V2'],  { defval: '' });
  const locations = XLSX.utils.sheet_to_json(wb.Sheets['Locations-Venio-V2'], { defval: '' });

  // Index contacts by customer code
  const contactMap = {};
  contacts.forEach(c => {
    const code = String(c['Customer Code'] || '').trim();
    if (code && !contactMap[code]) {
      contactMap[code] = {
        name: cleanStr(c['Contact Name '] || c['Contact Name']),
        phone: cleanPhone(c['Mobile'] || c['Telephone']),
      };
    }
  });

  // Index locations by customer code — pick Billing first, then first available
  const locationMap = {};
  locations.forEach(l => {
    const code = String(l['Customer Code'] || '').trim();
    if (!code) return;
    const existing = locationMap[code];
    const isBilling = String(l['Location Type'] || '').toLowerCase().includes('billing');
    const hasCoords = l['Latitude'] && l['Longitude'];
    if (!existing || (isBilling && !existing._isBilling) || (hasCoords && !existing.lat)) {
      locationMap[code] = {
        address:  cleanStr(l['Address']),
        province: cleanProvince(l['Province']),
        lat:      parseFloat(l['Latitude']) || null,
        lng:      parseFloat(l['Longitude']) || null,
        _isBilling: isBilling,
      };
    }
  });

  // Filter: skip header-like rows, keep all statuses
  const rows = customers.filter(r => {
    const code = String(r['Customer Code'] || '').trim();
    return code && code.match(/^[CL]\d+/);
  });

  console.log(`Found ${rows.length} rows to import (${customers.length} total)`);

  let created = 0, updated = 0, skipped = 0, errors = 0;
  const BATCH = 50;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const ops = batch.map(async (r) => {
      try {
        const code = String(r['Customer Code'] || '').trim();
        const rawName = String(r['Customer Name'] || '').trim();
        if (!rawName || rawName === '-' || rawName === '- -') {
          skipped++;
          return;
        }

        const contact = contactMap[code] || {};
        const loc     = locationMap[code] || {};

        const province = loc.province || cleanProvince(r['Province'] || '');
        const grp      = cleanStr(r['Customer Group']);
        const zone     = inferZone(province, grp);

        // Map pipelineStage
        const pipeline = mapPipeline(r['State']);

        // Determine agencyScore from Grade Quality
        const agencyScore = (() => {
          const gq = String(r['Grade Quality'] || '').trim();
          if (gq.match(/^1\s*=/)) return 'A';
          if (gq.match(/^2\s*=/)) return 'A';
          if (gq.match(/^3\s*=/)) return 'B';
          if (gq.match(/^4\s*=/)) return 'C';
          if (gq.match(/^5\s*=/)) return 'D';
          return null;
        })();

        // Determine tier from Grade Relationship
        const tier = (() => {
          const gr = String(r['Grade Relationship'] || '').toUpperCase();
          if (gr.startsWith('A')) return 'platinum';
          if (gr.startsWith('B')) return 'gold';
          if (gr.startsWith('C')) return 'silver';
          if (gr.startsWith('D')) return 'bronze';
          if (gr.startsWith('E')) return 'new';
          return 'new';
        })();

        // Advertise → paidAds / advertisesOurProjects
        const advertises = String(r['Advertise about us'] || '').toLowerCase() === 'yes';

        // sellsOurProjects from Grade Relationship "A = Sold for us"
        const soldForUs = String(r['Grade Relationship'] || '').toUpperCase().startsWith('A');

        const data = {
          name:             rawName,
          type:             grp,
          status:           mapStatus(r['Status']),
          level:            mapLevel(r['Grade Quality']),
          tier,
          pipelineStage:    pipeline,
          phone:            cleanPhone(r['Mobile'] || r['Telephone']),
          email:            cleanStr(r['E-mail']),
          website:          cleanStr(r['Website']),
          tiktok:           cleanStr(r['Tiktok']),
          ownerName:        contact.name,
          classification:   cleanStr(r['Classification']),
          gradeQuality:     cleanStr(r['Grade Quality']),
          gradeRelationship: cleanStr(r['Grade Relationship']),
          source:           cleanStr(r['Source of Customer']),
          tags:             cleanStr(r['Extra Tags']),
          remark:           cleanStr(r['Note']),
          province,
          zone,
          address:          loc.address,
          latitude:         loc.lat,
          longitude:        loc.lng,
          geocodeSource:    (loc.lat && loc.lng) ? 'venio' : null,
          agencyScore,
          advertisesOurProjects: advertises || null,
          sellsOurProjects:  soldForUs || null,
        };

        // Remove null keys to avoid overwriting existing data on upsert update
        const cleanData = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== null && v !== undefined)
        );

        const result = await prisma.agency.upsert({
          where: { code },
          create: { code, ...cleanData },
          update: cleanData,
        });

        if (result) {
          // Check if we created or updated (simple heuristic via createdAt vs updatedAt diff)
          const isNew = result.createdAt.getTime() === result.updatedAt.getTime() ||
                        (Date.now() - result.createdAt.getTime()) < 5000;
          if (isNew) created++; else updated++;
        }
      } catch (e) {
        errors++;
        const code = String(r['Customer Code'] || '').trim();
        if (errors <= 5) console.error(`  Error on ${code}:`, e.message);
      }
    });

    await Promise.all(ops);

    if ((i + BATCH) % 200 === 0 || i + BATCH >= rows.length) {
      console.log(`  Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} | created:${created} updated:${updated} skipped:${skipped} errors:${errors}`);
    }
  }

  console.log('\n✅ Import complete!');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
