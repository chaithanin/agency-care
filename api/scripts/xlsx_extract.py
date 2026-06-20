import zipfile, xml.etree.ElementTree as ET, json, os, datetime
path = r"C:\Users\MANAGER-IT\Downloads\Final Agency List.xlsx"
M='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z=zipfile.ZipFile(path)
shared=[]
r=ET.fromstring(z.read('xl/sharedStrings.xml'))
for si in r.findall('m:si',ns):
    shared.append(''.join(t.text or '' for t in si.iter(M+'t')))
wb=ET.fromstring(z.read('xl/workbook.xml'))
sheet_names=[s.get('name') for s in wb.iter(M+'sheet')]
# map sheetN -> name via order
rels=z.read('xl/_rels/workbook.xml.rels')
# simpler: sheets are sheet1..sheet5 in order of workbook sheet list
def colL(ref): return ''.join(c for c in ref if c.isalpha())
def serial_to_date(v):
    try:
        f=float(v)
        if f<1: return None
        return (datetime.datetime(1899,12,30)+datetime.timedelta(days=f)).strftime('%Y-%m-%d')
    except: return None

HEAD=['Customer Name','Mobile','Telephone','E-mail','Customer Group','Classification',
'Source','OwnerCol','Advertise','Extra Tags','Grade Quality','Grade Relationship',
'Agency Visit','Agency Visit Us','Sold','Bring customer','Priority','R']
def cellval(c):
    t=c.get('t'); v=c.find('m:v',ns)
    if v is not None:
        return shared[int(v.text)] if t=='s' else v.text
    isel=c.find('m:is',ns)
    if isel is not None: return ''.join(x.text or '' for x in isel.iter())
    return ''
out=[]
counts={}
for idx,sname in enumerate(sheet_names,1):
    sheet=ET.fromstring(z.read(f'xl/worksheets/sheet{idx}.xml'))
    rows=sheet.findall('.//m:row',ns)
    n=0
    for row in rows:
        rid=int(row.get('r'))
        if rid==1: continue
        d={}
        for c in row.findall('m:c',ns):
            d[colL(c.get('r'))]=cellval(c)
        name=(d.get('A') or '').strip()
        if not name: continue
        out.append({
          'sales': sname,
          'name': name,
          'mobile': (d.get('B') or '').strip(),
          'telephone': (d.get('C') or '').strip(),
          'email': (d.get('D') or '').strip(),
          'group': (d.get('E') or '').strip(),
          'classification': (d.get('F') or '').strip(),
          'source': (d.get('G') or '').strip(),
          'advertise': (d.get('I') or '').strip(),
          'tags': (d.get('J') or '').strip(),
          'gradeQuality': (d.get('K') or '').strip(),
          'gradeRelationship': (d.get('L') or '').strip(),
          'lastVisit': serial_to_date(d.get('M')),
          'sold': serial_to_date(d.get('O')),
          'priority': (d.get('Q') or '').strip(),
        })
        n+=1
    counts[sname]=n
os.makedirs(r"D:\github\agency-care\api\prisma\data",exist_ok=True)
with open(r"D:\github\agency-care\api\prisma\data\agencies.json","w",encoding="utf-8") as f:
    json.dump(out,f,ensure_ascii=False,indent=2)
print("TOTAL agencies:",len(out))
print("Per sales:",counts)
# unique groups & grades
print("GROUPS:",sorted(set(o['group'] for o in out if o['group'])))
print("GRADE Q:",sorted(set(o['gradeQuality'] for o in out if o['gradeQuality'])))
print("GRADE REL:",sorted(set(o['gradeRelationship'] for o in out if o['gradeRelationship'])))
print("CLASSIFICATION:",sorted(set(o['classification'] for o in out if o['classification'])))
print("with email:",sum(1 for o in out if o['email']),"/ with mobile:",sum(1 for o in out if o['mobile']))
