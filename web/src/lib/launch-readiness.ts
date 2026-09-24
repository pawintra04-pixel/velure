// What has to be true in the deployed environment before real shops and
// customers can rely on Velure — surfaced on /admin so the platform owner
// can see it without reading env vars. Only ever reports booleans/labels
// derived from configuration; never returns or renders a secret value.

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  /** What's wrong and what to do about it, shown only when !ok. */
  fix: string;
  /** Things the app can't detect from its own config (e.g. hosting plan). */
  manual?: boolean;
};

function set(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function getLaunchReadiness(): ReadinessCheck[] {
  const stripeSecret = process.env.STRIPE_SECRET_KEY ?? "";
  const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "";
  const baseUrl = process.env.APP_BASE_URL ?? "";

  return [
    {
      id: "stripe-live",
      label: "Stripe ใช้คีย์โหมดจริง (รับเงินจริงได้)",
      ok: stripeSecret.startsWith("sk_live_") || stripeSecret.startsWith("rk_live_"),
      fix: "ตอนนี้เป็นคีย์ทดสอบหรือยังไม่ได้ตั้ง — ยืนยันตัวตนบัญชี Stripe ของ Velure ให้ครบ แล้วตั้ง STRIPE_SECRET_KEY เป็นคีย์ sk_live_…",
    },
    {
      id: "stripe-publishable-live",
      label: "Stripe publishable key เป็นโหมดจริง และตรงกับ secret key",
      ok:
        stripePublishable.startsWith("pk_live_") &&
        (stripeSecret.startsWith("sk_live_") || stripeSecret.startsWith("rk_live_")),
      fix: "ตั้ง NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY เป็นคีย์ pk_live_… (ต้องเป็นโหมดเดียวกับ secret key)",
    },
    {
      id: "stripe-webhook",
      label: "Stripe webhook secret ตั้งค่าแล้ว",
      ok: set("STRIPE_WEBHOOK_SECRET"),
      fix: "สร้าง webhook ใน Stripe (โหมดจริง) ชี้มาที่ /api/stripe/webhook แล้วตั้ง STRIPE_WEBHOOK_SECRET — ถ้าไม่มี สถานะการจ่ายเงินจะไม่อัปเดต",
    },
    {
      id: "email-key",
      label: "ส่งอีเมลได้ (มี Resend API key)",
      ok: set("RESEND_API_KEY"),
      fix: "สมัคร resend.com สร้าง API key แล้วตั้ง RESEND_API_KEY — ตอนนี้ระบบข้ามการส่งอีเมลยืนยัน/เตือนทั้งหมด",
    },
    {
      id: "email-domain",
      label: "อีเมลผู้ส่งเป็นโดเมนของเราเอง (ส่งถึงลูกค้าจริงได้)",
      ok: Boolean(fromEmail) && !fromEmail.includes("resend.dev"),
      fix: "อีเมลทดสอบ onboarding@resend.dev ส่งได้แค่เข้าอีเมลเจ้าของบัญชี — ยืนยันโดเมนของตัวเองใน Resend แล้วตั้ง RESEND_FROM_EMAIL เช่น Velure <no-reply@โดเมนของคุณ>",
    },
    {
      id: "line",
      label: "LINE Official Account เชื่อมแล้ว",
      ok: set("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN"),
      fix: "สร้าง LINE Official Account + Messaging API channel แล้วตั้ง LINE_MESSAGING_CHANNEL_ACCESS_TOKEN — ตอนนี้ข้อความทาง LINE ถูกข้ามทั้งหมด",
    },
    {
      id: "base-url",
      label: "ลิงก์ในข้อความชี้ไปที่เว็บจริง",
      ok: baseUrl.startsWith("https://") && !baseUrl.includes("localhost"),
      fix: "ตั้ง APP_BASE_URL เป็น URL จริง เช่น https://velure-beta.vercel.app หรือโดเมนของคุณ",
    },
    {
      id: "cron",
      label: "งานอัตโนมัติรายวัน (เตือนก่อนถึงคิว / ส่งซ้ำ) ป้องกันด้วยรหัสลับ",
      ok: set("CRON_SECRET"),
      fix: "ตั้ง CRON_SECRET เพื่อไม่ให้คนนอกเรียกงานอัตโนมัติได้",
    },
    {
      id: "legal-contact",
      label: "มีอีเมลติดต่อเรื่องข้อมูลส่วนบุคคล (แสดงในหน้านโยบาย)",
      ok: set("LEGAL_CONTACT_EMAIL"),
      fix: "ตั้ง LEGAL_CONTACT_EMAIL เป็นอีเมลที่ใช้รับเรื่อง PDPA — กฎหมายกำหนดให้มีช่องทางติดต่อ",
    },
    {
      id: "hosting-plan",
      label: "Vercel แพ็กเกจ Pro (อนุญาตใช้เชิงพาณิชย์)",
      ok: false,
      manual: true,
      fix: "ระบบตรวจเองไม่ได้ — แพ็กเกจฟรี (Hobby) ห้ามใช้หารายได้ อัปเกรดที่ vercel.com → Settings → Billing ก่อนเริ่มเก็บเงินจริง",
    },
    {
      id: "legal-review",
      label: "นโยบายความเป็นส่วนตัว / ข้อกำหนด ผ่านการตรวจโดยผู้รู้กฎหมาย",
      ok: false,
      manual: true,
      fix: "หน้า /privacy และ /terms เป็นฉบับร่าง — ควรให้ผู้เชี่ยวชาญ PDPA ตรวจก่อนเปิดใช้เชิงพาณิชย์",
    },
  ];
}
