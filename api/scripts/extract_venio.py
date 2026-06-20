# ดึงข้อมูลจาก Global Top Group (Venio export) -> agencies-v2.json
# Customers (Active) + พิกัดจาก Locations
import zipfile, xml.etree.ElementTree as ET, json, os
path = r"C:\Users\MANAGER-IT\Downloads\Global Top Group_16-06-2026.xlsx"
M='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'; ns={'m':M[1:-1]}
z=zipfile.ZipFile(path)
shared=[]
r=ET.fromstring(z.read('xl/sharedStrings.xml'))
for si in r.findall('m:si',ns): shared.append(''.join(t.text or '' for t in si.iter(M+'t')))
wb=ET.fromstring(z.read('xl/workbook.xml')); names=[s.get('name') for s in wb.iter(M+'sheet')]
def colL(ref): return ''.join(c for c in ref if c.isalpha())
def cv(c):
    t=c.get('t'); v=c.find('m:v',ns)
    if v is not None: return shared[int(v.text)] if t=='s' else v.text
    isel=c.find('m:is',ns); return ''.join(x.text or '' for x in isel.iter()) if isel is not None else ''
def rows(name):
    idx=names.index(name)+1; sh=ET.fromstring(z.read(f'xl/worksheets/sheet{idx}.xml'))
    return [{colL(c.get('r')):cv(c) for c in row.findall('m:c',ns)} for row in sh.findall('.//m:row',ns)]

cust=rows('Customers-Venio-V2')[1:]; loc=rows('Locations-Venio-V2')[1:]
coords={}
for l in loc:
    code=(l.get('A') or '').strip(); lat=l.get('K'); lng=l.get('L')
    if code and lat and lng and code not in coords:
        try: coords[code]=(float(lat),float(lng))
        except: pass

def zone(group):
    g=(group or '').lower()
    if 'pattaya' in g: return 'พัทยา/ชลบุรี'
    if 'bangkok' in g: return 'กรุงเทพ'
    if 'phuket' in g: return 'ภูเก็ต'
    if 'oversea' in g: return 'ต่างประเทศ'
    return None
clean=lambda s:(s or '').strip() or None
out=[]; skip=0
for c in cust:
    if (c.get('F') or '').strip()!='Active': continue          # เฉพาะ Active
    code=(c.get('A') or '').strip(); name=(c.get('B') or '').strip()
    if not code or not name or name.replace('-','').strip()=='':  # ข้ามชื่อว่าง/ขีด
        skip+=1; continue
    cc=coords.get(code)
    out.append({
        'code':code,'name':name,'type':clean(c.get('M')),
        'classification':clean(c.get('P')),'phone':clean(c.get('H')) or clean(c.get('I')),
        'email':(c.get('J') or '').strip() if '@' in (c.get('J') or '') else None,
        'source':clean(c.get('Q')),'note':clean(c.get('R')),
        'zone':zone(c.get('M')),
        'lat':cc[0] if cc else None,'lng':cc[1] if cc else None,
    })
os.makedirs(r"D:\github\agency-care\api\prisma\data",exist_ok=True)
json.dump(out,open(r"D:\github\agency-care\api\prisma\data\agencies-v2.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(f"เขียน agencies-v2.json: {len(out)} ราย (ข้ามชื่อว่าง {skip})")
print(f"  มีพิกัด GPS: {sum(1 for a in out if a['lat'])}")
print(f"  มีมือถือ: {sum(1 for a in out if a['phone'])} · อีเมล: {sum(1 for a in out if a['email'])}")
