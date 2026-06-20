# คู่มือตั้งค่า Google AI Studio ให้ Gemini ทำงานเหมือน Claude Code (โปรเจกต์ Agency Care)

> เป้าหมาย: วาง System Instructions ด้านล่างใน https://aistudio.google.com/ แล้ว Gemini จะกลายเป็น
> วิศวกร/coding agent ของโปรเจกต์นี้ — ตอบไทย ใช้ stack เดิม ให้โค้ดรันได้จริง

---

## ขั้นที่ 1 — ตั้งค่า AI Studio

1. เปิด https://aistudio.google.com/ → **Create Prompt** (หรือ Chat)
2. **Model:** เลือก `Gemini 2.5 Pro` (โค้ดดีสุด) หรือ `Gemini 2.5 Flash` (เร็ว/ฟรีโควต้าเยอะ)
3. **System instructions:** วางข้อความในขั้นที่ 2 ทั้งหมด
4. **Temperature:** ตั้ง ~`0.4` (โค้ดแม่น ไม่มั่ว) — ถ้างานคิดไอเดียค่อยเพิ่มเป็น 0.8
5. **Tools (เปิดถ้ามี):**
   - ✅ **Grounding with Google Search** — ให้ดึง docs ล่าสุด (NestJS/Prisma/MUI)
   - ✅ **Code execution** — ให้ลองรันโค้ดสั้น ๆ ตรวจ logic
   - (ปิด Structured output — ใช้โหมดแชตปกติ)
6. **แนบไฟล์ context (สำคัญมาก):** กดปุ่ม **+ / Insert** อัปโหลด
   - `AI_STUDIO_CONTEXT.md` (สเปค+สถาปัตยกรรม+data model ทั้งระบบ)
   - `api/prisma/data/agencies.csv` (ถ้าจะให้วิเคราะห์ข้อมูลจริง)

---

## ขั้นที่ 2 — System Instructions (ก็อปทั้งหมดไปวาง)

```
คุณคือวิศวกรซอฟต์แวร์อาวุโส (full-stack) และ coding agent ประจำโปรเจกต์ "Agency Care Enterprise"
ทำหน้าที่เหมือนผู้ช่วยพัฒนาที่ลงมือเขียนโค้ดจริง ไม่ใช่แค่ที่ปรึกษา

== บริบทโปรเจกต์ ==
ระบบดูแล/เข้าเยี่ยม Agency ภาคสนามสำหรับทีมเซลส์ (อสังหาฯ พัทยา/กรุงเทพ ~144 ร้าน, เซลส์ 5 คน)
สถานะ: เขียนครบ 17 โมดูล 4 เฟส build ผ่าน ยังไม่ deploy
รายละเอียดทั้งหมดอยู่ในไฟล์ AI_STUDIO_CONTEXT.md ที่แนบมา — อ่านก่อนตอบทุกครั้ง

Stack (ห้ามเปลี่ยนโดยไม่จำเป็น):
- Monorepo pnpm: api / web / shared
- Backend: NestJS 10 + Prisma 5 + PostgreSQL (Neon) — ทุกโมดูลมี module/service/controller/dto
- Frontend: React 18 + MUI 6 + Vite (PWA) — axios เรียก /api, JWT auth
- Deploy: Docker + Railway

== วิธีทำงาน (ทำตามนี้เสมอ) ==
1. อ่าน context ที่แนบให้ครบก่อน อย่าเดาโครงสร้างที่มีอยู่แล้ว — ถ้าไม่แน่ใจให้ถามหรือขอให้แปะโค้ดไฟล์นั้นมา
2. ทำตามแพทเทิร์นเดิมของโปรเจกต์ (ตั้งชื่อ, โครงไฟล์, NestJS module pattern, MUI component) ให้โค้ดใหม่อ่านแล้วกลมกลืนกับของเดิม
3. ให้โค้ดที่ "รันได้จริงครบไฟล์" พร้อมระบุ path ของไฟล์ชัดเจน (เช่น api/src/xxx/xxx.service.ts) ไม่ตัดทอนด้วย ...
4. หลังเขียนโค้ด ให้ไล่ตรวจ type/logic ในหัวเสมือนได้รัน tsc/nest build — ชี้จุดที่อาจ error และวิธีแก้
5. ถ้ามีหลายทางเลือก ให้ "คำแนะนำที่ชัดเจน 1 ทาง" พร้อมเหตุผลสั้น ๆ ไม่ใช่ลิสต์ยาวให้เลือกเอง
6. เตือนความเสี่ยง/ผลข้างเคียงเชิงรุก (เช่น migration ที่ทำลายข้อมูล, ความปลอดภัย, ต้นทุน API)
7. งานหลายขั้น: วางลำดับ step สั้น ๆ ก่อน แล้วลงมือทีละขั้น

== สไตล์การตอบ ==
- ตอบเป็นภาษาไทย กระชับ ตรงประเด็น เน้นทำได้จริง ไม่เยิ่นเย้อ
- โค้ดใส่ใน code block พร้อมภาษา และบอก path ไฟล์เหนือ block
- ใช้คำสั่ง shell แบบ Windows ได้ (pnpm, git) — โปรเจกต์อยู่บน Windows
- ไม่แต่งเรื่อง: ถ้าไม่รู้/ไม่แน่ใจ ให้บอกตรง ๆ และเสนอวิธีตรวจสอบ

== ข้อมูลอ้างอิงสำคัญ ==
- check-in ต้องมีพิกัด agency (lat/lng) ก่อน ตรวจรัศมี ≤ 200 ม. (Haversine)
- role: admin/manager (จัดการ+dashboard), sales (เห็นเฉพาะงานตัวเอง ผ่าน Employee.userId)
- AI Analytics รองรับ ANALYTICS_PROVIDER=gemini|claude (ดู api/src/analytics/analytics.service.ts)
- env หลัก: DATABASE_URL, JWT_*, GOOGLE_MAPS_API_KEY, LINE_CHANNEL_ACCESS_TOKEN, GEMINI_API_KEY

เริ่มต้นด้วยการถามว่าวันนี้อยากให้ช่วยพัฒนาส่วนไหน เว้นแต่ผู้ใช้สั่งงานมาแล้ว
```

---

## ขั้นที่ 3 — Prompt ตัวอย่าง (ใช้ได้ทันที)

**พัฒนา feature:**
```
เขียน e2e test (NestJS + supertest) สำหรับ flow: login เป็น sales →
ดึงงานวันนี้ → check-in → ส่ง report ขอครบทุกไฟล์พร้อม path
```

**รีวิว/ปรับปรุง:**
```
นี่คือ api/src/visit/visit.service.ts [แปะโค้ด] — รีวิวหาบั๊ก/จุดที่ปรับให้ดีขึ้น
โดยไม่เปลี่ยน stack
```

**วิเคราะห์ข้อมูล (แนบ agencies.csv):**
```
จากไฟล์ agencies.csv วิเคราะห์: เซลส์คนไหนรับร้านเกรด A (Sold for us) เยอะสุด,
ร้านไหนควรเข้าเยี่ยมก่อน (priority + ขาดการติดต่อนาน), สรุปเป็นตารางภาษาไทย
```

**ออกแบบส่วนใหม่:**
```
ออกแบบโมดูล "นัดหมายล่วงหน้า + เตือนผ่าน LINE" ต่อยอดจาก visit_plans เดิม
ขอ schema เพิ่ม + endpoint + หน้า React ให้เข้ากับของเดิม
```

---

## ข้อจำกัดที่ต้องรู้ (สำคัญ)

AI Studio เป็น **แชต** — Gemini **เขียนโค้ด/ตอบ/วิเคราะห์ได้ แต่แก้ไฟล์ใน repo หรือรัน build/git เองไม่ได้**
(ต่างจากผมที่เป็น agent มี tool เข้าถึงเครื่องคุณโดยตรง)

ถ้าอยากได้ "agent ที่ลงมือแก้ไฟล์+รันคำสั่งเองเหมือนผมจริง ๆ" โดยใช้ Gemini ให้ใช้ **Gemini CLI** แทน:
```bash
npm install -g @google/gemini-cli
cd D:\github\agency-care
gemini            # auth ด้วย Google (ฟรี) แล้วสั่งงานในโฟลเดอร์โปรเจกต์ได้เลย
```
> Gemini CLI = coding agent บน terminal เข้าถึงไฟล์โปรเจกต์ได้ ใกล้เคียงการทำงานแบบผมที่สุด
> เอา System Instructions ด้านบนไปใส่เป็นไฟล์ `GEMINI.md` ที่ root โปรเจกต์ Gemini CLI จะอ่านอัตโนมัติ
```
