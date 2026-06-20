# Deploy Agency Care → Google Cloud Run

Project: `gtg-crm-499607` · Region: `asia-east2` · DB: Neon Postgres · ไฟล์: Google Cloud Storage

> ทำ **ขั้น 1–4 ครั้งเดียว** จากนั้น deploy ซ้ำได้ด้วย `.\deploy.ps1`

---

## 1) เตรียม Database (Neon) + migration แรก
```powershell
# สร้าง DB ที่ neon.tech → copy connection string
$env:DATABASE_URL = "postgresql://USER:PASS@HOST.neon.tech/DB?sslmode=require"

cd D:\github\agency-care\api
pnpm prisma migrate dev --name init    # สร้างไฟล์ migration + ตาราง (ครั้งแรกเท่านั้น)
pnpm prisma:seed                       # admin คนแรก
pnpm prisma:import                     # 144 agency (ถ้าต้องการ)
cd ..
git add api/prisma/migrations; git commit -m "add initial migration"   # commit migration ลง repo
```

## 2) สร้าง GCS bucket (เก็บรูป check-in)
```powershell
$PROJECT="gtg-crm-499607"; $REGION="asia-east2"; $BUCKET="agency-care-uploads-$PROJECT"
gcloud storage buckets create gs://$BUCKET --location=$REGION --uniform-bucket-level-access
# ให้รูปเปิดดูผ่าน <img> ได้ (⚠️ public-read: ใครมี url ก็ดูได้)
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member=allUsers --role=roles/storage.objectViewer
# ให้ Cloud Run upload ได้
$NUM = gcloud projects describe $PROJECT --format="value(projectNumber)"
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member="serviceAccount:$NUM-compute@developer.gserviceaccount.com" --role=roles/storage.objectAdmin
```

## 3) เก็บ secrets ใน Secret Manager (ไม่ใส่ในคำสั่งตรงๆ)
```powershell
# DATABASE_URL
$env:DATABASE_URL | gcloud secrets create agency-database-url --data-file=-
# JWT secrets (สุ่มค่า)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" | gcloud secrets create agency-jwt-access --data-file=-
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" | gcloud secrets create agency-jwt-refresh --data-file=-
# (ตัวเลือก) key อื่นๆ — แล้วไป uncomment ใน deploy.ps1
# "YOUR_GEMINI_KEY"      | gcloud secrets create agency-gemini-key --data-file=-
# "YOUR_MAPS_KEY"        | gcloud secrets create agency-maps-key --data-file=-
# "YOUR_LINE_TOKEN"      | gcloud secrets create agency-line-token --data-file=-

# ให้ Cloud Run SA อ่าน secret ได้
$NUM = gcloud projects describe gtg-crm-499607 --format="value(projectNumber)"
gcloud projects add-iam-policy-binding gtg-crm-499607 --member="serviceAccount:$NUM-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
```

## 4) Deploy
```powershell
$env:DATABASE_URL = "postgresql://...neon..."   # เพื่อให้ migrate ทำงาน
.\deploy.ps1
```
→ ได้ URL `https://agency-care-xxxx.a.run.app` (HTTPS — GPS check-in ใช้ได้)

---

## ครั้งถัดไป (แก้โค้ดแล้ว deploy ใหม่)
```powershell
$env:DATABASE_URL = "..."   # ถ้ามี migration ใหม่
.\deploy.ps1
```

## หมายเหตุ
- **CORS**: ตอนนี้ตั้ง `CORS_ORIGIN=*` (web เสิร์ฟจาก origin เดียวกับ api อยู่แล้ว) — ปรับให้เข้มได้ถ้าต้องการ
- **รูปเป็น private**: ถ้าไม่อยากให้ bucket public → เปลี่ยนเป็น signed URL / API proxy (ขอให้ช่วยได้)
- **ค่าใช้จ่าย**: `min-instances 0` = scale-to-zero (จ่ายเฉพาะตอนมีคนใช้) · cold start ~2-5 วิ
- **ข้อมูล PII** (`api/prisma/data/`) ไม่ถูกส่งขึ้น build (กันไว้ใน `.gcloudignore`)
