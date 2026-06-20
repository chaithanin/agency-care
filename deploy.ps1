# deploy.ps1 — deploy Agency Care ขึ้น Google Cloud Run
# ใช้: ตั้ง $env:DATABASE_URL (ชี้ไป Neon) ก่อน แล้วรัน  .\deploy.ps1
$ErrorActionPreference = "Stop"

# ===== ปรับค่าตรงนี้ =====
$PROJECT = "gtg-crm-499607"
$REGION  = "asia-east2"
$SERVICE = "agency-care"
$BUCKET  = "agency-care-uploads-$PROJECT"   # ต้องตรงกับ bucket ที่สร้างไว้

# ===== 1) Migration (รันจากเครื่องนี้ ใช้ DATABASE_URL ใน env) =====
if ($env:DATABASE_URL) {
  Write-Host "==> รัน prisma migrate deploy ..." -ForegroundColor Cyan
  pnpm --filter ./api exec prisma migrate deploy
} else {
  Write-Warning "ไม่ได้ตั้ง `$env:DATABASE_URL` — ข้าม migration"
  Write-Warning "ถ้ายังไม่เคย migrate: ตั้ง `$env:DATABASE_URL` แล้วรัน  pnpm --filter ./api exec prisma migrate deploy  ก่อน"
}

# ===== 2) Deploy ขึ้น Cloud Run (build จาก Dockerfile บน Cloud Build) =====
Write-Host "==> deploy $SERVICE ไป Cloud Run ($REGION) ..." -ForegroundColor Cyan
gcloud run deploy $SERVICE `
  --source . `
  --project $PROJECT `
  --region $REGION `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --set-env-vars "GCS_BUCKET=$BUCKET,ANALYTICS_PROVIDER=gemini,CORS_ORIGIN=*,JWT_ACCESS_TTL=15m,JWT_REFRESH_TTL=7d" `
  --set-secrets "DATABASE_URL=agency-database-url:latest,JWT_ACCESS_SECRET=agency-jwt-access:latest,JWT_REFRESH_SECRET=agency-jwt-refresh:latest"
  # --- secret ตัวเลือก (เปิดใช้เมื่อต้องการฟีเจอร์นั้น) ต่อท้ายบรรทัดบนด้วย , ---
  # ,GEMINI_API_KEY=agency-gemini-key:latest,GOOGLE_MAPS_API_KEY=agency-maps-key:latest,LINE_CHANNEL_ACCESS_TOKEN=agency-line-token:latest

Write-Host "==> เสร็จ! ดู URL ด้านบน (https://$SERVICE-xxxx.a.run.app)" -ForegroundColor Green
