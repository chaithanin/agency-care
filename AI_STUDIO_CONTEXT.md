# Agency Care Enterprise — Project Context (สำหรับ Google AI Studio / Gemini)

> วางทั้งไฟล์นี้ใน **System Instructions** ของ AI Studio (หรือข้อความแรก) เพื่อให้ Gemini เข้าใจโปรเจกต์ทั้งหมดก่อนช่วยงานต่อ

---

## 1. ภาพรวม

**Agency Care Enterprise** = ระบบดูแล/เข้าเยี่ยม Agency (ตัวแทน/ร้านค้า) สำหรับทีมเซลส์ภาคสนาม
ธุรกิจจริง: เซลส์ 5 คนดูแล Agency อสังหาฯ ~144 ร้านย่านพัทยา/กรุงเทพ — ต้องวางแผนเข้าเยี่ยม, เช็คอิน GPS หน้างาน, ถ่ายรูปยืนยัน, รายงานผล, แจกสื่อ, บันทึกยอดขาย และให้ผู้บริหารเห็นภาพรวม

สถานะ: **เขียนครบทั้ง 4 เฟส (17 โมดูล) build/typecheck ผ่านหมด** ยังไม่ deploy — รอเชื่อม Neon + API keys

---

## 2. เทคโนโลยี (Stack)

| ส่วน | เทคโนโลยี |
|------|-----------|
| โครงสร้าง | pnpm **monorepo** (`api` / `web` / `shared`) |
| Backend | **NestJS 10** + **Prisma 5** + PostgreSQL (**Neon**) |
| Frontend | **React 18** + **MUI 6** + **Vite 5** (PWA — รองรับมือถือ) |
| Auth | JWT (access/refresh) + argon2 · role: `admin` / `manager` / `sales` |
| Mobile | ใช้เว็บ PWA (ไม่มี native) — GPS ผ่าน `navigator.geolocation`, กล้องผ่าน `<input capture>` |
| External | Google Maps (geocode), LINE Messaging API (แจ้งเตือน), Claude/Gemini (AI analytics) |
| Deploy | Docker + Railway (Dockerfile + railway.json พร้อม) |

**โครงสร้างโฟลเดอร์**
```
agency-care/
├── api/    NestJS — REST API (prefix /api) + เสิร์ฟ web build ตอน production
│   ├── prisma/schema.prisma   ← data model หลัก
│   └── src/<module>/          ← แต่ละโมดูล: module/service/controller/dto
├── web/    React + MUI + Vite (PWA) — port 5180 ตอน dev
└── shared/ TypeScript types ใช้ร่วม
```
> API พัฒนาด้วย NestJS modular pattern: ทุกโมดูลมี `*.module.ts` / `*.service.ts` / `*.controller.ts` และ register ใน `api/src/app.module.ts`

---

## 3. Data Model (Prisma — ตารางหลัก)

```
users(app)        — บัญชี login (email, passwordHash, role)
employees         — โปรไฟล์เซลส์ (code, name, zone, lineUserId, userId→users)
agencies          — ร้าน (code, name, level A/B/C/D, zone, province, lat/lng,
                    geocodeSource, classification, gradeQuality, gradeRelationship,
                    priority, source, tags, lastVisitAt)
agency_assignments— มอบหมาย agency↔employee (isActive)
visit_plans       — แผนเยี่ยม (agencyId, employeeId, planDate, status:
                    pending|done|postponed|cancelled)
visit_checkins    — เช็คอิน GPS (lat/lng, distanceMeters, withinRadius) 1:1 กับ plan
visit_photos      — รูป before/during/after (url, lat/lng, takenAt) → checkin
visit_reports     — รายงาน (purposes[], summary, problems, actionPlan) 1:1 กับ plan
posm_items        — คลังสื่อ (code, name, unit, stockQty)
posm_transactions — แจกสื่อในงานเยี่ยม (ตัดสต็อก) → visit_plan
products          — สินค้า (code, name, price)
sales_activities  — บันทึกการขาย (qtyOffered, qtySold, amount) → visit_plan
models            — อุปกรณ์/เดโม (code, status, currentAgencyId = อยู่ที่ไหน)
model_transactions— ประวัติเคลื่อนย้าย (deploy|return)
audit_logs        — log การกระทำสำคัญ
```

**ความสัมพันธ์ที่ควรรู้**
- 1 เซลส์ (Employee) ผูกกับ 1 บัญชี login (User) ถ้าตั้งให้ login ได้
- งานเข้าเยี่ยม 1 รอบ (VisitPlan) → 1 Checkin → หลาย Photo, + 1 Report, + แจก POSM/ขาย/อุปกรณ์
- check-in ต้องมี `agencies.latitude/longitude` ก่อน (ตรวจรัศมี ≤ 200 ม.)

---

## 4. 17 โมดูล (สถานะ = เสร็จทั้งหมด)

**เฟส 1 (MVP core loop):** Auth · Master Agency · Assignment · Visit Plan · GPS Check-in (Haversine, ปฏิเสธถ้าเกินรัศมี) · Photo (before/during/after) · Visit Report · Dashboard
**เฟส 2:** POSM (แจกสื่อ ตัดสต็อก atomic) · Sales Activity (conversion)
**เฟส 3:** Bulk Geocode (Google Places Text Search) · KPI ประเมินเซลส์ · LINE Notify (Messaging API + cron 08:00)
**เฟส 4:** Model/อุปกรณ์ (ติดตามตำแหน่ง) · Route Planning (nearest-neighbor + Google Maps directions) · AI Auto Assignment (heuristic บาลานซ์โซน/workload) · AI Analytics (LLM)

---

## 5. REST API (สรุป endpoint หลัก, prefix `/api`)

```
POST  /auth/login | /auth/refresh        GET /auth/me
GET   /agencies  POST /agencies  PATCH /agencies/:id   POST /agencies/geocode
GET   /employees POST /employees PATCH /employees/:id
POST  /assignments  DELETE /assignments  GET /assignments/employee/:id
POST  /auto-assign/propose | apply
POST  /visits/plans   GET /visits/plans?date=   GET /visits/plans/:id
POST  /visits/plans/:id/checkin           POST /visits/checkins/:cid/photos (multipart)
POST  /visits/plans/:id/report            PATCH /visits/plans/:id/status
GET   /route?date=                        (จัดเส้นทาง)
POST  /posm/items | /posm/transactions    GET /posm/items | /posm/transactions
POST  /products                           POST /sales
GET   /models  POST /models/deploy | /models/return
GET   /dashboard/summary                  GET /kpi?from=&to=
POST  /notifications/run                  POST /analytics/insights
```
> Role guard: ส่วนจัดการเป็น `admin`/`manager`; เซลส์เห็น/บันทึกเฉพาะงานตัวเอง (เช็คผ่าน `Employee.userId`)

---

## 6. การรันจริง

```bash
pnpm install
cd api && cp ../.env.example .env   # ใส่ DATABASE_URL (Neon) + API keys
cd .. && pnpm db:migrate            # สร้างตาราง
pnpm db:seed                        # admin + ข้อมูล demo
pnpm db:import                      # นำเข้า 144 agency จริง (จาก prisma/data/agencies.json)
pnpm dev                            # api :3000 + web :5180
```
**env ที่ใช้:** `DATABASE_URL` (บังคับ) · `JWT_*` · `GOOGLE_MAPS_API_KEY` (geocode) · `LINE_CHANNEL_ACCESS_TOKEN` (แจ้งเตือน) · `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` (AI analytics)

---

## 7. ข้อจำกัด / สิ่งที่ยังเปิดอยู่

- ข้อมูลจริงไม่มีพิกัด GPS → ต้องกด **Geocode อัตโนมัติ** หรือเติมพิกัดทีละร้านก่อน check-in
- GPS check-in บนมือถือ **ต้องใช้ HTTPS** (Railway มีให้) — HTTP LAN ใช้ไม่ได้
- รูปเก็บ local disk (`uploads/`) — production หลายเครื่องควรย้ายขึ้น S3/Cloud Storage
- ยังไม่มี test อัตโนมัติ
- ไฟล์ข้อมูล agency จริง (PII) ไม่ commit ลง git

---

## 8. สิ่งที่อยากให้ Gemini ช่วย (ตัวอย่าง — แก้ตามต้องการ)

- ออกแบบ feature เพิ่ม / รีวิวสถาปัตยกรรม
- เขียน test (e2e/unit) ให้ NestJS + Prisma
- ปรับ heuristic การแบ่งทีม หรือเพิ่ม route optimization แบบจริงจัง
- ออกแบบ prompt วิเคราะห์ข้อมูลทีมขาย (ดู `api/src/analytics/analytics.service.ts`)
- ช่วยทำ Flutter app เวอร์ชัน native (ถ้าตัดสินใจทำ)

> **คำสั่งให้ Gemini:** "นี่คือ context ของระบบ Agency Care ตอบเป็นภาษาไทย เน้นทำได้จริงบน stack นี้ (NestJS/Prisma/React/MUI) อย่าเปลี่ยน stack โดยไม่จำเป็น"
