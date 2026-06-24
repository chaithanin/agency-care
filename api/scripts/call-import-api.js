/**
 * Extract data from Venio Excel and POST to /agencies/bulk-import
 * Usage: node api/scripts/call-import-api.js <excel> <api-base> <admin-email> <admin-password>
 * Example: node api/scripts/call-import-api.js "C:\...\file.xlsx" https://agency.chaithanin.com/api admin@x.com Pass123
 */

const path = require('path');
const https = require('https');
const http = require('http');
const XLSX = require(path.join('D:\\github\\node_modules\\xlsx'));

function cleanStr(v) {
  const s = String(v ?? '').trim();
  return s || null;
}
function cleanPhone(p) {
  const s = String(p ?? '').trim().replace(/[^0-9+\-\s()]/g, '').substring(0, 30);
  return s || null;
}
function mapStatus(v) { return String(v ?? '').trim() === 'Active' ? 'active' : 'inactive'; }
function mapPipeline(state) {
  const s = String(state ?? '').toLowerCase();
  if (s === 'lead' || s === 'prospect') return 'prospect';
  return 'active';
}
function mapLevel(gq) {
  const s = String(gq ?? '');
  if (s.match(/^1\s*=/)) return 'A'; if (s.match(/^2\s*=/)) return 'A';
  if (s.match(/^3\s*=/)) return 'B'; if (s.match(/^4\s*=/)) return 'C';
  if (s.match(/^5\s*=/)) return 'D'; return 'C';
}
function mapTier(gr) {
  const s = String(gr ?? '').toUpperCase();
  if (s.startsWith('A')) return 'platinum'; if (s.startsWith('B')) return 'gold';
  if (s.startsWith('C')) return 'silver';  if (s.startsWith('D')) return 'bronze';
  return 'new';
}
function normProv(p) {
  const s = String(p ?? '').trim();
  const m = { 'ชลบุรี':'ชลบุรี','Chon Buri':'ชลบุรี','Chang Wat Chon Buri':'ชลบุรี',
    'Bangkok':'กรุงเทพฯ','กรุงเทพ':'กรุงเทพฯ','กรุงเทพมหานคร':'กรุงเทพฯ',
    'Phuket':'ภูเก็ต','ภูเก็ต':'ภูเก็ต','Rayong':'ระยอง','ระยอง':'ระยอง',
    'Chiang Mai':'เชียงใหม่','เชียงใหม่':'เชียงใหม่' };
  return m[s] || s || null;
}
function inferZone(prov, grp) {
  const p = String(prov ?? '').toLowerCase(), g = String(grp ?? '').toLowerCase();
  if (p.includes('ชลบุรี') || p.includes('chon') || p.includes('pattaya')) return 'พัทยา';
  if (p.includes('กรุงเทพ') || p.includes('bangkok')) return 'กรุงเทพฯ';
  if (p.includes('ภูเก็ต') || p.includes('phuket')) return 'ภูเก็ต';
  if (g.includes('oversea') || g.includes('online')) return 'Oversea';
  return null;
}

async function apiCall(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const [,, excelPath, apiBase, email, password] = process.argv;
  if (!excelPath || !apiBase || !email || !password) {
    console.error('Usage: node call-import-api.js <excel> <api-base> <email> <password>');
    process.exit(1);
  }

  // 1. Login
  console.log('Logging in to', apiBase);
  const loginRes = await apiCall(`${apiBase}/auth/login`, 'POST', { email, password }, null);
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.error('Login failed:', loginRes.body); process.exit(1);
  }
  const token = loginRes.body.accessToken;
  console.log('Logged in ✓');

  // 2. Read Excel
  console.log('Reading', excelPath);
  const wb = XLSX.readFile(excelPath);
  const customers = XLSX.utils.sheet_to_json(wb.Sheets['Customers-Venio-V2'], { defval: '' });
  const contacts  = XLSX.utils.sheet_to_json(wb.Sheets['Contacts-Venio-V2'],  { defval: '' });
  const locations = XLSX.utils.sheet_to_json(wb.Sheets['Locations-Venio-V2'], { defval: '' });

  const contactMap = {};
  contacts.forEach(c => {
    const code = String(c['Customer Code'] ?? '').trim();
    if (code && !contactMap[code]) contactMap[code] = { name: cleanStr(c['Contact Name '] || c['Contact Name']), phone: cleanPhone(c['Mobile'] || c['Telephone']) };
  });

  const locMap = {};
  locations.forEach(l => {
    const code = String(l['Customer Code'] ?? '').trim();
    if (!code) return;
    const ex = locMap[code], isBill = String(l['Location Type']??'').toLowerCase().includes('billing'), hasCoord = l['Latitude'] && l['Longitude'];
    if (!ex || (isBill && !ex._b) || (hasCoord && !ex.lat))
      locMap[code] = { address: cleanStr(l['Address']), province: normProv(l['Province']), lat: parseFloat(l['Latitude'])||null, lng: parseFloat(l['Longitude'])||null, _b: isBill };
  });

  // 3. Transform rows
  const rows = customers
    .filter(r => String(r['Customer Code']??'').trim().match(/^[CL]\d+/))
    .map(r => {
      const code = String(r['Customer Code']).trim();
      const c = contactMap[code] || {}, l = locMap[code] || {};
      const prov = l.province || normProv(r['Province'] || '');
      const grp = cleanStr(r['Customer Group']);
      return {
        code,
        name: String(r['Customer Name']??'').trim(),
        status: mapStatus(r['Status']),
        level: mapLevel(r['Grade Quality']),
        tier: mapTier(r['Grade Relationship']),
        pipelineStage: mapPipeline(r['State']),
        phone: cleanPhone(r['Mobile'] || r['Telephone']) || c.phone,
        email: cleanStr(r['E-mail']),
        website: cleanStr(r['Website']),
        tiktok: cleanStr(r['Tiktok']),
        ownerName: c.name,
        type: grp,
        classification: cleanStr(r['Classification']),
        gradeQuality: cleanStr(r['Grade Quality']),
        gradeRelationship: cleanStr(r['Grade Relationship']),
        source: cleanStr(r['Source of Customer']),
        tags: cleanStr(r['Extra Tags']),
        remark: cleanStr(r['Note']),
        province: prov,
        zone: inferZone(prov, grp),
        address: l.address,
        latitude: l.lat,
        longitude: l.lng,
        geocodeSource: (l.lat && l.lng) ? 'venio' : null,
        advertisesOurProjects: String(r['Advertise about us']??'').toLowerCase() === 'yes' ? true : null,
        sellsOurProjects: String(r['Grade Relationship']??'').toUpperCase().startsWith('A') ? true : null,
      };
    })
    .filter(r => r.name && r.name !== '-' && r.name !== '- -');

  console.log(`Prepared ${rows.length} rows. Sending in batches...`);

  // 4. POST in batches of 100
  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await apiCall(`${apiBase}/agencies/bulk-import`, 'POST', { rows: batch }, token);
    if (res.status === 200 || res.status === 201) {
      totalCreated += res.body.created ?? 0;
      totalUpdated += res.body.updated ?? 0;
      totalSkipped += res.body.skipped ?? 0;
      if (res.body.errors?.length) console.log('  Errors:', res.body.errors.slice(0, 3));
    } else {
      console.error('  Batch error:', res.status, res.body);
    }
    const done = Math.min(i + BATCH, rows.length);
    console.log(`  ${done}/${rows.length} — created:${totalCreated} updated:${totalUpdated} skipped:${totalSkipped}`);
  }

  console.log('\n✅ Import complete!');
  console.log(`   Created: ${totalCreated}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Skipped: ${totalSkipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
