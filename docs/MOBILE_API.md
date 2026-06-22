# Agency Care — Mobile / Android Integration Spec

สเปคสำหรับทีมที่จะพัฒนา **Android app** ต่อจากระบบเดิม โดยใช้ **backend + ฐานข้อมูลตัวเดียวกัน**
(ไม่ต้องต่อ DB ตรง — ยิง REST API พอ)

> สร้างจากโค้ดจริง — ถ้าแก้ controller/schema กรุณาอัปเดตไฟล์นี้ด้วย

---

## 1. Architecture

```
Android App ─┐
Web (React)  ─┼─► REST API (NestJS 10) ─► PostgreSQL (Cloud SQL)
             │            │
             │            ├─► GCS  (เก็บรูป)
             │            ├─► Vertex AI (Gemini — analytics/summary)
             │            └─► LINE Messaging API (แจ้งเตือน)
```

- **Base URL (production):** `https://agency-care-oohrdxzlwq-df.a.run.app/api`
- รูปแบบข้อมูล: JSON ทั้งหมด · CORS เปิด `*` (ยิงจากมือถือได้)
- Stack: NestJS + Prisma 5 + PostgreSQL · รูปเก็บบน Google Cloud Storage

---

## 2. Authentication (JWT)

ทุก route ต้องแนบ token **ยกเว้น** `/auth/login`, `/auth/refresh`

| Endpoint | Body | Response |
|----------|------|----------|
| `POST /auth/login` | `{ email, password }` | `{ accessToken, refreshToken, user:{ id,email,name,role } }` |
| `POST /auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `GET /auth/me` | — | โปรไฟล์ปัจจุบัน |

- Header ทุก request: `Authorization: Bearer <accessToken>`
- **access TTL = 15 นาที** → หมดอายุให้เรียก `/auth/refresh` (**refresh TTL = 7 วัน**)
- เก็บ token ใน `EncryptedSharedPreferences` / Keystore

**Roles:** `admin` (เห็นทุกอย่าง) · `manager` (ทีมตัวเอง) · `sales` (งานตัวเอง — *user หลักของ Android*)

---

## 3. Flow หลักของแอปเซลส์ (โฟกัสตรงนี้)

```
login
 └─ GET  /scheduling/my-day            งานวันนี้ของฉัน (visits + เวรออฟฟิศ)
 └─ GET  /visits/plans?date=YYYY-MM-DD รายการแผนเยี่ยม
 └─ GET  /visits/plans/:id             รายละเอียด + พิกัด agency
 └─ POST /visits/plans/:id/checkin     ส่ง GPS → ตรวจรัศมี/mock
 └─ POST /visits/checkins/:cid/photos  ถ่ายรูปยืนยัน (multipart)
 └─ PATCH /visits/checkins/:cid/contact ผู้เข้าพบ (ผู้ดูแล agency)
 └─ POST /visits/checkins/:cid/checkout จบงาน (คิด durationMinutes)
 └─ POST /visits/plans/:id/report      สรุปงาน
 └─ POST /visits/plans/:id/followups   งานติดตามต่อ
```

เพิ่มเติมสำหรับเซลส์: `GET /scheduling/my-calendar`, `POST /scheduling/my-holidays/toggle`,
`GET /route?date=` (ลำดับเยี่ยม + ลิงก์ Google Maps), `POST /visits/plans/:id/reschedule` (เลื่อนนัด + เหตุผล),
`POST /visits/plans/:id/work-photos` (รูปการทำงาน — ไม่ต้อง check-in)

---

## 4. API ทั้งหมด

| กลุ่ม | Endpoints |
|------|-----------|
| **auth** | `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me` |
| **scheduling** | `GET /scheduling/my-day` · `/my-calendar` · `POST /scheduling/my-holidays/toggle` · `GET /scheduling/daily` · `/calendar` · `/live` · `/coverage` · `/team-dashboard` · `/monthly-dashboard` · `/seller-performance` · `/teams` · `/office` · `/new-agency` · `/unmet` · `POST /scheduling/generate-month` · `/generate-fortnight` · `/holidays/toggle` · `/company-holidays/toggle` |
| **visits (core)** | `GET/POST /visits/plans` · `GET /visits/plans/:id` · `PATCH /visits/plans/:id/status` · `POST …/checkin` · `…/reschedule` · `…/work-photos` · `…/report` · `…/followups` · `GET …/followups` · `PATCH /visits/followups/:taskId/toggle` · `POST /visits/checkins/:cid/checkout` · `PATCH …/contact` · `POST …/photos` |
| **agency** | `GET /agencies` · `/agencies/pipeline` · `/agencies/:id` · `POST /agencies` · `/agencies/geocode` · `PATCH /agencies/:id` |
| **route** | `GET /route?date=` |
| **employees/teams** | `GET/POST /employees` · `GET /employees/:id` · `PATCH /employees/:id` · `POST/DELETE /assignments` · `GET /assignments/employee/:id` |
| **posm** | `GET /posm/items` · `/posm/inventory` · `POST /posm/items` · `…/items/:id/adjust` · `POST /posm/transactions` · `GET /posm/transactions` |
| **products/sales** | `GET/POST /products` · `PATCH /products/:id` · `POST/GET /sales` |
| **models (demo unit)** | `GET/POST /models` · `POST /models/deploy` · `/models/return` · `PATCH /models/:id/status` |
| **dashboard/report** | `GET /dashboard/summary` · `GET /kpi` · `POST /analytics/insights` · `GET /auto-assign/propose` · `POST /auto-assign/apply` |
| **users (admin)** | `GET/POST /users` · `PATCH /users/:id` · `POST /users/:id/reset-password` |
| **notifications** | `POST /notifications/daily-schedule` · `/daily-summary` · `/run` |

---

## 5. Data Model (PostgreSQL / Prisma)

> field ใช้ camelCase ใน API; ใน DB เป็น snake_case (`@map`)

- **User** `id, email, name, role(admin/manager/sales), isActive`
- **Employee** `id, userId, code, name, phone, zone, position(sales/closer), teamId, inTraining, lineUserId, isActive`
- **Agency** `id, code, name, level(A/B/C/D), tier(platinum/gold/silver/bronze/new), pipelineStage(new/prospect/onboarding/active/grade_a/at_risk/inactive), status, province, zone, ownerName, managerName, phone, email, latitude, longitude, geocodeSource, classification, gradeQuality, gradeRelationship, lastVisitAt, addedById`
- **AgencyAssignment** `agencyId ↔ employeeId, isActive` (มอบหมาย)
- **VisitPlan** `id, agencyId, employeeId, planDate(@Date), status(pending/done/postponed/cancelled), note` — *หัวใจระบบ*
- **VisitCheckin** `visitPlanId, employeeId, checkinAt, checkOutAt, durationMinutes, latitude, longitude, distanceMeters, withinRadius, gpsStatus(in_area/near/out), accuracyMeters, contactName, contactPosition, contactPhone, deviceInfo, ipAddress, isMockGps`
- **VisitPhoto** `checkinId, url, phase(before/during/after/office/activity/material/selfie), latitude, longitude, takenAt`
- **VisitWorkPhoto** `visitPlanId, url, caption, latitude, longitude, takenAt`
- **VisitReport** `visitPlanId, purposes[], summary, problems, actionPlan`
- **FollowUpTask** — งานติดตาม
- **PosmItem / PosmTransaction** — สื่อส่งเสริมการขาย
- **Product / SalesActivity** — สินค้า/ยอดขาย
- **Model / ModelTransaction** — อุปกรณ์เดโม
- **Team / WorkCalendar / EmployeeHoliday / MonthlyPlan / DailySchedule / DailyScheduleItem** — ระบบตารางงาน

---

## 6. สิ่งที่ต้องรู้ตอนทำ Android

- **อัปโหลดรูป:** `multipart/form-data`, field ชื่อ **`photo`** (image เท่านั้น, ≤ 8 MB)
  → backend อัปขึ้น GCS แล้วคืน `{ url }`. ส่ง lat/lng ไปด้วยได้ (ลายน้ำ/ตรวจสอบ)
- **GPS check-in:** ส่ง `{ latitude, longitude, accuracyMeters }`
  → backend คำนวณ `distanceMeters` จากพิกัด Agency เอง, ตั้ง `gpsStatus` (in_area/near/out)
  และตรวจ **mock GPS** → ใช้ `FusedLocationProvider` high-accuracy, ส่ง accuracy มาด้วย
- **กล้อง:** ระบบออกแบบให้ **ถ่ายจริงเท่านั้น** (เว็บปิด upload ไฟล์) → Android ใช้ CameraX แล้ว POST blob
- **วันที่:** `planDate` เป็น date-only → ส่ง `YYYY-MM-DD`
- **LINE:** ผูกที่ `Employee.lineUserId` เพื่อรับ push

---

## 7. ฟีเจอร์ที่มีแล้ว (พร้อมทำ native ต่อ)

Auth + Roles · แผนเยี่ยม + GPS Check-in/out (รัศมี, mock GPS, ระยะเวลา, ผู้เข้าพบ) ·
ถ่ายรูปยืนยันหลายเฟส + รูปการทำงาน · รายงานเยี่ยม + Follow-up · เลื่อนนัด + เหตุผล ·
AI Scheduling (24 วัน/เดือน, 15 ร้าน/สัปดาห์, tier ความถี่, จัดทีมอัตโนมัติ) ·
ปฏิทินงาน + วันหยุดบริษัท/รายคน · Route + Google Maps · Dashboard/KPI/Seller Performance/Pipeline ·
POSM/สินค้า/อุปกรณ์เดโม · AI วิเคราะห์ (Gemini) · สรุปงานรายวัน → Email + LINE · i18n ไทย/อังกฤษ
