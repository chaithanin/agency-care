# Agency Care Enterprise

ระบบดูแล/เข้าเยี่ยม Agency ภาคสนาม สำหรับทีมเซลส์ — วางแผนเยี่ยม, GPS check-in, ถ่ายรูปยืนยัน, รายงานผล, dashboard ผู้บริหาร

> สถาปัตยกรรมเดียวกับโปรเจกต์ CRM (pnpm monorepo · NestJS + Prisma + Neon · React + MUI + Vite PWA · JWT · Railway/Docker)

## โครงสร้าง (MVP เฟส 1)

```
agency-care/
├── api/      NestJS + Prisma (REST API + เสิร์ฟ web build ใน production)
├── web/      React + MUI + Vite (PWA — รองรับมือถือ: GPS + กล้อง)
└── shared/   TypeScript types ที่ใช้ร่วมกัน
```

### โมดูล MVP
- **Auth** — login JWT, role: `admin` / `manager` / `sales`
- **Master Agency** — ข้อมูลเอเจนซี่ + พิกัด GPS + รูป
- **Assignment** — มอบหมาย Agency ให้เซลส์
- **Visit Plan** — วางแผนเข้าเยี่ยม (รายวัน/สัปดาห์)
- **Check-in GPS** — เช็คตำแหน่ง ตรวจรัศมี (ปฏิเสธถ้าเกินรัศมีที่ตั้งไว้)
- **Visit Photo** — บังคับถ่ายรูป before/during/after + เก็บ GPS/เวลา
- **Visit Report** — สรุปผล/ปัญหา/action plan
- **Dashboard** — ภาพรวมเข้าเยี่ยมครบ/ไม่ครบ, KPI เบื้องต้น

เฟส 2+: POSM, Model/อุปกรณ์, Sales Activity, Route Planning, Notification (LINE OA), KPI, AI Analytics

## เริ่มใช้งาน (dev)

```bash
pnpm install
cp .env.example .env          # ใส่ DATABASE_URL (Neon) + JWT secrets
cd api && cp ../.env.example .env
pnpm db:migrate               # สร้างตาราง
pnpm db:seed                  # สร้าง admin คนแรก
pnpm dev                      # api :3000 + web :5173
```

## เทคโนโลยี
| ส่วน | Stack |
|------|-------|
| Backend | NestJS 10, Prisma 5, PostgreSQL (Neon) |
| Frontend | React 18, MUI 6, Vite 5, react-router |
| Auth | JWT (access/refresh) + argon2 |
| Deploy | Docker + Railway |
