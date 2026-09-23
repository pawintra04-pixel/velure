# Velure — สรุปโปรเจกต์สำหรับขอฟีดแบ็ก

## โปรเจกต์นี้คืออะไร

Velure เป็นแพลตฟอร์มรับจองคิว/รับเงิน/จัดคิวอัตโนมัติ สำหรับ SME ไทยกลุ่ม fitness / spa / คลินิก / ร้านเสริมสวย
จุดขายหลักไม่ใช่ "AI booking software" แต่คือ **"รับจอง รับเงิน และจัดคิวให้อัตโนมัติ"** — จุดต่างที่ชูคือรองรับ PromptPay, กันการจองซ้ำที่ระดับฐานข้อมูลจริง (ไม่ใช่แค่ UI), และในอนาคตจะมี LINE OA notification (localization คือเดิมพันหลัก ไม่ใช่ฟีเจอร์ AI)

ตอนนี้เป็น MVP ที่ build จริง ใช้งานได้ end-to-end แล้ว ไม่ใช่ prototype/mockup

## Tech stack

- **Next.js 16** (App Router, Turbopack, React Server Components + Server Actions)
- **PostgreSQL** — รันผ่าน `embedded-postgres` (ไม่ต้องใช้ Docker) ตอน dev, multi-tenant ด้วย **Row-Level Security (RLS)** จริงในระดับ database ไม่ใช่แค่ filter ใน query
- **Stripe Connect** (Standard accounts) — รับเงินแทนร้านค้าแต่ละราย, รองรับ PromptPay + บัตรเครดิต/เดบิตต่างประเทศ
- **Resend** — ส่งอีเมลยืนยันการจอง (เขียนโค้ดเสร็จแล้ว ยังไม่เคยทดสอบส่งจริงเพราะยังไม่มี API key)
- Auth ทำเอง (ไม่ใช้ library) — scrypt hash password, session token เก็บใน httpOnly cookie ผูกกับตาราง sessions (revoke ได้จริงโดยลบ row ไม่ใช่ JWT ที่ revoke ยาก)

## สถาปัตยกรรม/การตัดสินใจสำคัญที่อยากได้ฟีดแบ็ก

1. **กันการจองซ้ำ (double-booking) ด้วย Postgres EXCLUDE constraint** (ไม่ใช่ unique index ธรรมดา, ไม่ใช่ application-level lock) — ใช้ `tstzrange` overlap ต่อ staff คนเดียวกัน กันแม้เวลาซ้อนกันบางส่วนไม่ใช่เวลาตรงกันเป๊ะ พิสูจน์ด้วยการยิง concurrent request ชนกันจริงก่อนเริ่มเขียนแอปจริงด้วยซ้ำ (ทำ "spike" พิสูจน์ 4 เรื่องก่อน scaffold: atomic booking, tenant isolation, Stripe+PromptPay, webhook idempotency)

2. **Quick booking flow** — ลูกค้าเลือกเวลาแล้ว "จองที่นั่งไว้ก่อนทันที" (สถานะ TEMPORARY_HOLD, ยังไม่กรอกชื่อ/เบอร์/อีเมล) ค่อยกรอกรายละเอียดทีหลัง แทนที่จะบังคับกรอกฟอร์มยาวๆ ก่อนเลือกเวลา — ลด friction ตอนจอง โดย hold มี TTL 10 นาที และ sweep hold ที่หมดอายุทิ้งก่อนทุกครั้งที่มีคนพยายามจองใหม่ (ไม่มี cron/scheduler แยก)

3. **State machine เดียวสำหรับสถานะการจอง** (TEMPORARY_HOLD → PAYMENT_PENDING → CONFIRMED → COMPLETED/NO_SHOW, มี CANCELLED/EXPIRED/PAYMENT_FAILED) — ตั้งใจไม่ใช้ boolean หลายตัว (isPaid, isConfirmed แยกกัน) เพราะจะ sync กันยากขึ้นเรื่อยๆ

4. **ระบบ "คลาส" แบบจองได้หลายที่นั่ง (multi-seat)** — ต่อยอดจากโมเดล 1:1 เดิม ไม่ได้เขียนระบบคู่ขนานแยกต่างหาก: ผู้เข้าร่วมแต่ละคนยังเป็น booking แถวปกติ แค่แปะ tag ว่าอยู่ session ไหน ใช้ระบบ payment/cancel/status เดิมได้หมด ส่วนการกันจองเกินที่นั่งใช้ atomic counter (`UPDATE ... WHERE seats_booked < capacity`) แยกจาก overlap constraint เดิม

5. **Availability engine** — คำนวณช่วงเวลาว่างจากการตัดกัน (intersection) ของเวลาเปิดร้านรายวัน + ตารางงานพนักงานแต่ละคน (รวม break time) ไม่ใช่ hardcode เวลาเปิดปิดแบบเดียวทั้งระบบ

6. **Payment**: Stripe Connect แบบ Standard account (Custom/Express ใช้กับแพลตฟอร์มไทยไม่ได้ — ข้อจำกัดจาก Stripe เอง), webhook idempotent โดย key ด้วย `event.id` ไม่ใช่ `payment_intent_id` (เพราะ payment เดียวยิง event ได้หลายแบบ)

## ฟีเจอร์ที่ทำเสร็จแล้ว (ใช้งานได้จริง ทดสอบแล้ว)

**ฝั่งร้านค้า (Owner dashboard)**
- สมัคร/ล็อกอินจริง แยก business แต่ละรายสมบูรณ์ (RLS กันข้อมูลรั่วข้ามร้าน — ทดสอบจริงด้วย 2 account พร้อมกัน)
- Dashboard ภาพรวม (ยอดจองวันนี้ รายได้เดือนนี้ กราฟรายเดือน โดนัทสถานะการจอง)
- จัดการ Services (ราคา/ระยะเวลา/buffer/โหมดจ่ายเงิน free-deposit-full, ใส่รูป+คำอธิบาย, ตั้งคำถามเพิ่มเติมให้ลูกค้ากรอกตอนจองแบบ optional/important/required)
- จัดการ Team/staff (มอบหมายบริการที่ทำได้, ตั้งเวลาทำงาน+เวลาพักรายวันของแต่ละคน)
- ปฏิทินการจอง (List/Day/Week/Month), เปลี่ยนสถานะ Complete/No-show/Cancel
- Reports (breakdown by staff/service, filter ตามช่วงเวลา, export CSV, print view)
- Settings ร้านค้า (ประเภทธุรกิจ โลโก้ คำอธิบาย ที่อยู่ ช่องทางติดต่อ เวลาเปิด-ปิดรายวัน)
- ตารางคลาสแบบจองหลายที่นั่ง (ตั้งค่า service ให้มี capacity, นัดตาราง session, ดูจำนวนที่นั่งที่จองแล้ว)
- Responsive จริงทั้ง desktop และมือถือ (เมนูข้างยุบเป็น hamburger บนมือถือ)

**ฝั่งลูกค้า (Public booking page)**
- เลือกบริการ → เลือกเวลา (จองทันทีแบบไม่ต้องล็อกอิน) → กรอกรายละเอียด → จ่ายเงิน (PromptPay/บัตร) หรือข้ามขั้นจ่ายเงินถ้าฟรี → หน้ายืนยัน
- จองคลาสแบบเลือกที่นั่งจาก session ที่ร้านตั้งไว้ (แสดงจำนวนที่นั่งเหลือ)
- Self-service reschedule/cancel ผ่านลิงก์ (ไม่ต้องล็อกอิน) ภายใต้ policy ที่ร้านตั้ง (เช่น เลื่อนได้ก่อน 12 ชม. ยกเลิกได้ก่อน 24 ชม.)
- Header ทุกหน้ามีโลโก้/ชื่อร้านกดกลับหน้าแรกได้
- Responsive ทั้ง desktop/มือถือ, UI time-picker ออกแบบเองไม่ให้เหมือนคู่แข่งเจ้าตลาด (Setmore)

## ยังไม่ได้ทำ / ข้อจำกัดที่รู้ตัวอยู่

- ไม่มีหน้า CRUD จัดการลูกค้า (customers) — สร้างได้จาก booking flow เท่านั้น
- ไม่มี AI onboarding assistant (มีแผนไว้แต่เลื่อนไป Phase 2)
- ไม่มี embed widget (ฝังหน้าจองในเว็บร้านค้าอื่น)
- ไม่มีระบบ refund
- ธุรกิจที่เพิ่งสมัครใหม่ยังไม่มี UI ให้เชื่อม Stripe account ของตัวเอง (ต้องต่อให้ด้วยมือตอนนี้)
- อีเมลยืนยันการจอง เขียนโค้ดเสร็จแต่ยังไม่เคยทดสอบส่งจริง
- ยังไม่มีระบบเก็บเงินรายเดือน/รายปีจาก "ร้านค้า" (SaaS billing ของ Velure เอง) — มีแค่ระบบรับเงินแทนร้านค้าจากลูกค้าปลายทาง
- คลาส (multi-seat) ยังไม่รองรับคำถามเพิ่มเติมแบบที่บริการเดี่ยวมี, เจ้าของร้านยังยกเลิกทั้ง session ที่มีคนจองแล้วไม่ได้ (ต้องยกเลิกทีละคนก่อน), ตั้ง capacity ได้แค่ตอนสร้างบริการเท่านั้น แก้ทีหลังไม่ได้
- LINE OA notification (ที่บอกว่าสำคัญที่สุดสำหรับตลาดไทย) ยังไม่เริ่มทำเลย

## อยากได้ฟีดแบ็กเรื่องอะไรเป็นพิเศษ

1. Positioning/scope ของ MVP เหมาะสมไหมสำหรับ SME ไทยกลุ่มนี้ — ฟีเจอร์ไหนควรทำก่อน/หลัง จากที่ยังไม่ได้ทำ (LINE OA vs refund vs embed widget vs AI onboarding)
2. โมเดลข้อมูล/สถาปัตยกรรมมีจุดเสี่ยงอะไรที่มองข้ามไปไหม โดยเฉพาะเรื่อง concurrency/security ในระบบจอง-จ่ายเงิน
3. การตัดสินใจไม่ทำ subscription billing ของตัวเอง (เก็บแค่ค่าคอมมิชชัน/transaction ผ่าน Stripe Connect) เหมาะกับโมเดลธุรกิจนี้ไหม หรือควรมี pricing tier แบบรายเดือนคู่กัน
4. UX ของ quick-booking (จองก่อนกรอกข้อมูล) มีความเสี่ยงอะไรบ้าง (เช่น spam holds, no-show สูงขึ้น) ควรมีมาตรการอะไรเพิ่ม
