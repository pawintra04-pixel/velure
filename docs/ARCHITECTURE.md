# Velure — Architecture Decisions

สรุป decision ที่ล็อกไว้แล้วก่อนเริ่ม scaffold โค้ดจริง (อัปเดตหลัง product review รอบที่สอง)

## Positioning

หัวข้อหลักไม่ใช่ "AI booking software" แต่คือ:

> รับจอง รับเงิน และจัดคิวให้อัตโนมัติ

Supporting points: PromptPay · LINE · No double booking · AI-assisted setup

AI เป็นตัวเร่งความง่าย ไม่ใช่คำขายหลัก

## Booking status — state machine (ไม่ใช้ boolean)

```
TEMPORARY_HOLD
  -> PAYMENT_PENDING
    -> CONFIRMED
      -> COMPLETED
      -> NO_SHOW
    -> PAYMENT_FAILED
    -> EXPIRED
  -> CANCELLED
CONFIRMED -> REFUNDED / PARTIALLY_REFUNDED (via cancellation policy)
```

ห้ามใช้ `isPaid` / `isConfirmed` / `isCancelled` เป็น boolean แยกกัน — ใช้ enum เดียวที่เป็น source of truth

## Temporary slot hold (กัน double-book จริง)

Hold ต้องเกิด **ตอนลูกค้าเลือกเวลา** ไม่ใช่รอ Stripe webhook อย่างเดียว เพราะสองคน checkout พร้อมกันได้:

1. ลูกค้าเลือกเวลา → สร้าง row สถานะ `TEMPORARY_HOLD` พร้อม TTL (เช่น 10 นาที) ผ่าน DB transaction ที่มี unique constraint บน (staff_id/resource_id, start_time) สำหรับสถานะ active
2. คนที่สองเลือกเวลาเดียวกันในช่วง hold นี้ต้องถูก reject ทันทีที่ระดับ DB ไม่ใช่ระดับ UI
3. สร้าง Stripe PaymentIntent ผูกกับ hold นี้
4. Webhook confirm สำเร็จ → `TEMPORARY_HOLD/PAYMENT_PENDING` → `CONFIRMED`
5. Timeout หรือจ่ายไม่สำเร็จ → `EXPIRED`/`PAYMENT_FAILED` → ปล่อย slot คืน

Webhook ต้อง idempotent: Stripe อาจส่ง event ซ้ำ ต้องเช็ค `payment_intent_id` ที่ process ไปแล้วก่อนสร้าง side-effect ซ้ำ

## Timezone

เก็บ timestamp เป็น UTC เสมอ, แต่ละ business มี field `timezone` (เช่น `Asia/Bangkok`) ใช้แปลงตอน render — ทำตั้งแต่ต้นเพราะรื้อยากมากทีหลัง โดยเฉพาะถ้าขยายไปพื้นที่ท่องเที่ยว/ต่างประเทศ

## Payment & security

- ไม่เก็บเลขบัตร/CVC เด็ดขาด ปล่อยให้ Stripe handle ทั้งหมด (Stripe.js / Elements ฝั่ง client)
- เก็บเฉพาะ: `stripe_customer_id`, `payment_intent_id`, `payment_status`, `amount`, `currency`
- รองรับ 3 โหมดต่อบริการ: free booking / deposit บางส่วน / จ่ายเต็มจำนวน — ร้านตั้งค่าเองต่อบริการ (อยู่ใน MVP ไม่ใช่ Phase 2)
- PromptPay ผ่าน Stripe เหมาะกับ one-time payment เท่านั้น — โมเดล subscription/สมาชิกรายเดือน (Phase 3) ต้องออกแบบแยก (เช่น เก็บผ่านบัตรแทน)

## Multi-tenant isolation

- ทุกตารางข้อมูลธุรกิจมีคอลัมน์ `business_id` (ไม่มีข้อยกเว้น)
- Authorization enforce ที่ server/database เท่านั้น (ไม่ใช่แค่ frontend ไม่แสดงข้อมูลร้านอื่น) — ทุก query ต้อง scope ด้วย `business_id` จาก session/token เสมอ ไม่รับจาก client input ตรงๆ

## Customer record (thin, อยู่ใน MVP)

เก็บอย่างน้อย: name, phone, email, booking history, notes — dedupe ด้วยเบอร์โทร/อีเมลต่อ business_id กันคนเดิมกลายเป็นหลาย record

## MVP scope (6 engines)

1. **Business Setup** — AI onboarding, services, staff, working hours, resources, buffer time
2. **Booking Engine** — standalone page + embed, service → staff → date/time, mobile-first, ไทย/อังกฤษ
3. **Availability Engine** — staff/room availability, buffer, temporary hold, DB-level collision protection
4. **Payment Engine** — free/deposit/full payment, บัตร + PromptPay ผ่าน Stripe Connect, webhook confirmation, payment expiry
5. **Booking Management** — calendar, **reschedule**, **cancel** (ตาม policy ที่ร้านตั้ง เช่น เลื่อนได้ก่อน 12 ชม., ยกเลิกได้ก่อน 24 ชม.), complete, no-show
6. **Communications** — email confirmation, email reminder, staff notification

**ย้ายออกจาก MVP → Phase 2**: AI ผู้ช่วยค้นหาคิวระหว่างวัน (ตัดสินใจแล้วว่ายังไม่ใช่สิ่งพิสูจน์ PMF รอบแรก — ตัดสินใจไว้ให้ต่อ booking engine ที่พิสูจน์แล้วก่อน)

**Phase 2 priority สูงสุด**: แจ้งเตือน LINE OA (ไม่ต้องรอ packages/CRM/analytics เสร็จก่อน เพราะ localization คือเดิมพันหลักของ Velure)

## Phase 0 — Prove (ก่อน scaffold app จริง)

อย่าเขียน production app ก่อนพิสูจน์ 4 เรื่องด้วย spike เล็กๆ:

1. **Stripe Connect + PromptPay** — merchant connected account → สร้าง booking ฿100 → PromptPay QR → ลูกค้าจ่าย → webhook → booking confirmed → merchant ได้เงิน
2. **Atomic booking** — ยิง 2 request พร้อมกันเข้า slot เดียวกัน ต้องมีแค่ 1 booking รอด
3. **Webhook reliability** — ส่ง webhook event ซ้ำ ต้องไม่สร้าง booking ซ้ำ (idempotency)
4. **Tenant isolation** — พยายามเปลี่ยน business ID ใน API request ต้องไม่มีทางเห็นข้อมูลร้านอื่น

ผ่านทั้ง 4 ข้อ → ค่อย scaffold แอปจริง

**ต้องมีก่อนเริ่ม spike**: Stripe test-mode account พร้อมเปิดใช้ Connect และ test secret key
