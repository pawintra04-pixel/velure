// Owner dashboard translations only — the public booking pages stay
// English (see 028_owner_locale.sql's comment for why). Deliberately not a
// generic framework (next-intl, etc.): this is one language pair on one
// section of the app, so a plain typed dictionary plus a few formatter
// functions for pluralized/dynamic strings covers it without adding a
// dependency or a build step. Thai has no grammatical plural, so th's
// formatters never branch on count the way en's do.
export type Locale = "en" | "th";

export function resolveLocale(value: string): Locale {
  return value === "th" ? "th" : "en";
}

// --- Sidebar navigation ---

export const navLabels: Record<Locale, Record<string, string>> = {
  en: {
    overview: "Overview",
    bookings: "Bookings",
    calendar: "Calendar",
    customers: "Customers",
    services: "Services",
    team: "Team",
    classes: "Classes",
    resources: "Resources",
    share: "Share",
    reports: "Reports",
    settings: "Settings",
    logOut: "Log out",
    setUp: "Set up",
  },
  th: {
    overview: "ภาพรวม",
    bookings: "การจอง",
    calendar: "ปฏิทิน",
    customers: "ลูกค้า",
    services: "บริการ",
    team: "พนักงาน",
    classes: "คลาส",
    resources: "ห้อง",
    share: "แชร์",
    reports: "รายงาน",
    settings: "ตั้งค่า",
    logOut: "ออกจากระบบ",
    setUp: "ยังไม่ตั้งค่า",
  },
};

// --- Overview page ---

export const overview: Record<Locale, Record<string, string>> = {
  en: {
    quickAdd: "Quick add",
    newBooking: "+ New booking",
    needsAttention: "Needs attention",
    allCaughtUp: "All caught up — nothing needs attention right now.",
    review: "Review",
    view: "View",
    finish: "Finish",
    alreadyStarted: "Already started",
    unpaid: "unpaid",
    stripeSetupIncomplete: "Stripe setup incomplete",
    cardPaymentsOff: "Card payments are off",
    performance: "Performance",
    revenueThisMonth: "Revenue this month",
    bookingsToday: "Bookings today",
    totalCustomers: "Total customers",
    todaysSchedule: "Today's schedule",
    openCalendar: "Open calendar →",
    nothingScheduledToday: "Nothing scheduled today",
    upNext: "Up next",
    with: "with",
  },
  th: {
    quickAdd: "เพิ่มด่วน",
    newBooking: "+ จองใหม่",
    needsAttention: "ต้องดำเนินการ",
    allCaughtUp: "เรียบร้อยดี ไม่มีอะไรต้องดำเนินการตอนนี้",
    review: "ตรวจสอบ",
    view: "ดู",
    finish: "ทำให้เสร็จ",
    alreadyStarted: "เริ่มไปแล้ว",
    unpaid: "ยังไม่ชำระเงิน",
    stripeSetupIncomplete: "ตั้งค่า Stripe ยังไม่เสร็จ",
    cardPaymentsOff: "ยังรับชำระด้วยบัตรไม่ได้",
    performance: "ผลประกอบการ",
    revenueThisMonth: "รายได้เดือนนี้",
    bookingsToday: "การจองวันนี้",
    totalCustomers: "ลูกค้าทั้งหมด",
    todaysSchedule: "ตารางงานวันนี้",
    openCalendar: "เปิดปฏิทิน →",
    nothingScheduledToday: "วันนี้ไม่มีคิว",
    upNext: "คิวถัดไป",
    with: "กับ",
  },
};

export function tTodayLabel(locale: Locale, date: Date): string {
  return locale === "th"
    ? new Intl.DateTimeFormat("th-TH", {
        timeZone: "Asia/Bangkok",
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date)
    : new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date);
}

export function tTodayAt(locale: Locale, businessName: string): string {
  return locale === "th" ? `วันนี้ที่ ${businessName}` : `Today at ${businessName}`;
}

export function tPaymentsAwaiting(locale: Locale, count: number): string {
  if (locale === "th") return `มีการชำระเงินรอยืนยัน ${count} รายการ`;
  return `${count} payment${count === 1 ? "" : "s"} awaiting confirmation`;
}

export function tTotal(locale: Locale, amount: string): string {
  return locale === "th" ? `รวม ${amount}` : `${amount} total`;
}

export function tCountdown(locale: Locale, diffMin: number): string {
  if (diffMin < 0) return locale === "th" ? "เริ่มไปแล้ว" : "Already started";
  if (diffMin < 60) {
    return locale === "th" ? `เริ่มในอีก ${diffMin} นาที` : `Starts in ${diffMin} minute${diffMin === 1 ? "" : "s"}`;
  }
  const hours = Math.round(diffMin / 60);
  return locale === "th" ? `เริ่มในอีก ${hours} ชั่วโมง` : `Starts in ${hours} hour${hours === 1 ? "" : "s"}`;
}

export function tCountdownShort(locale: Locale, diffMin: number): string | null {
  if (diffMin < 0) return null;
  if (diffMin < 60) return locale === "th" ? `อีก ${diffMin} นาที` : `in ${diffMin} minute${diffMin === 1 ? "" : "s"}`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return locale === "th" ? `อีก ${hours} ชั่วโมง` : `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return null;
}

export function tMoreToday(locale: Locale, count: number): string {
  return locale === "th" ? `และอีก ${count} รายการวันนี้` : `+${count} more later today`;
}

export function tSeats(locale: Locale, booked: number, capacity: number): string {
  return locale === "th" ? `${booked}/${capacity} ที่นั่ง` : `${booked}/${capacity} seats`;
}
