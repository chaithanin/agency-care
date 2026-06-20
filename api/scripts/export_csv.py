# Export agencies.json -> CSV + slim JSON สำหรับวิเคราะห์ใน AI Studio (Gemini)
import json, csv, os
base = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'data')
src = os.path.join(base, 'agencies.json')
rows = json.load(open(src, encoding='utf-8'))

cols = ['sales','name','mobile','email','group','classification','source',
        'gradeQuality','gradeRelationship','priority','lastVisit','sold']
csv_path = os.path.join(base, 'agencies.csv')
with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:  # utf-8-sig = เปิดใน Excel ได้
    w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
    w.writeheader()
    for r in rows:
        w.writerow(r)

# slim JSON (ตัด field ว่าง) — อัปโหลดเข้า AI Studio ได้เลย
slim = [{k: v for k, v in r.items() if v} for r in rows]
json_path = os.path.join(base, 'agencies-clean.json')
json.dump(slim, open(json_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

print(f"CSV : {csv_path}  ({len(rows)} rows)")
print(f"JSON: {json_path}")
