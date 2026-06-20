# deploy.ps1 — deploy Agency Care ขึ้น Google Cloud Run (DB = Cloud SQL)
# Migration: รันแยกครั้งเดียวผ่าน Cloud SQL Auth Proxy (ดู DEPLOY.md) ไม่ทำใน script นี้
$ErrorActionPreference = "Stop"

# ===== ค่าคงที่ =====
$PROJECT  = "gtg-crm-499607"
$REGION   = "asia-east2"
$SERVICE  = "agency-care"
$BUCKET   = "agency-care-uploads-$PROJECT"
$SQL_CONN = "${PROJECT}:${REGION}:agency-care-db"   # Cloud SQL instance connection name

# ===== Deploy ขึ้น Cloud Run (build จาก Dockerfile บน Cloud Build) =====
Write-Host "==> deploy $SERVICE ไป Cloud Run ($REGION) ..." -ForegroundColor Cyan
gcloud run deploy $SERVICE `
  --source . `
  --project $PROJECT `
  --region $REGION `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --add-cloudsql-instances $SQL_CONN `
  --set-env-vars "GCS_BUCKET=$BUCKET,ANALYTICS_PROVIDER=gemini,CORS_ORIGIN=*,JWT_ACCESS_TTL=15m,JWT_REFRESH_TTL=7d" `
  --set-secrets "DATABASE_URL=agency-database-url:latest,JWT_ACCESS_SECRET=agency-jwt-access:latest,JWT_REFRESH_SECRET=agency-jwt-refresh:latest"
  # --- secret ตัวเลือก (เปิดใช้เมื่อต้องการฟีเจอร์นั้น) ต่อท้ายบรรทัดบนด้วย , ---
  # ,GEMINI_API_KEY=agency-gemini-key:latest,GOOGLE_MAPS_API_KEY=agency-maps-key:latest,LINE_CHANNEL_ACCESS_TOKEN=agency-line-token:latest

Write-Host "==> เสร็จ! ดู URL ด้านบน (https://$SERVICE-xxxx.a.run.app)" -ForegroundColor Green
