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
    waitlist: "Waitlist",
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
    waitlist: "รอคิว",
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

// --- Bookings page ---

export const bookingsText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Bookings",
    description: "Manage appointments across list, day, week, and month views.",
    showing: "Showing:",
    clear: "Clear",
    noBookingsFilter: "No bookings match this filter.",
    noBookingsYet: "No bookings yet.",
    noBookingsDay: "No bookings on this day.",
    prev: "← Prev",
    next: "Next →",
    unnamedCustomer: "Unnamed customer",
    unnamed: "Unnamed",
    inPerson: "In person",
    complete: "Complete",
    markComplete: "Mark complete",
    markCompleteTitle: "Mark this booking complete?",
    markCompleteDesc: "This records the appointment as done.",
    noShow: "No-show",
    markNoShow: "Mark no-show",
    markNoShowTitle: "Mark this booking as a no-show?",
    markNoShowDesc:
      "This records that the customer didn't turn up. It does not free the time slot or issue a refund.",
    cancel: "Cancel",
    cancelTitle: "Cancel this booking?",
    cancelDescBase: "Cancelling will free this time slot.",
    cancelDescPayment: " Payment will not automatically be refunded.",
    cancelBooking: "Cancel booking",
    keepBooking: "Keep booking",
    save: "Save",
    notePlaceholder: "Note — e.g. VIP, needs extra care",
    flag: "Flag",
    freeBooking: "Free booking",
    keepAsIs: "Cancel",
    paid: "paid",
    notYetPaid: "not yet paid",
    viewList: "List",
    viewDay: "Day",
    viewWeek: "Week",
    viewMonth: "Month",
    catAll: "All",
    catPaid: "Paid",
    catUnpaid: "Unpaid",
    catCompleted: "Completed",
    catCancelled: "Cancelled",
    filterConfirmed: "Confirmed",
    filterUnpaid: "Unpaid",
    filterCancelledNoShow: "Cancelled/no-show",
    filterPaid: "Paid",
    filterCompleted: "Completed",
    filterCancelled: "Cancelled",
    newBooking: "New booking",
    forPhoneEtc: "For a booking taken by phone, LINE, or walk-in",
    customerName: "Customer name",
    phoneNumber: "Phone number",
    emailOptional: "Email (optional)",
    noCharge: "No charge for this booking",
    creating: "Creating...",
    createBooking: "Create booking",
    close: "Close",
    refund: "Refund",
    full: "Full",
    partial: "Partial",
    continue: "Continue",
    refundNotice:
      "This sends money back to the customer's original payment method through Stripe. It cannot be undone from Velure.",
    cashRefundNotice:
      "This booking was paid in person, not through Stripe — this just records that you handed the money back. It doesn't move any money itself.",
    back: "Back",
    refunding: "Refunding…",
    confirmRefund: "Confirm refund",
    restoreSession: "Restore session",
    restoring: "Restoring…",
    confirmRestore: "Confirm restore",
    restoreNotice: "This booking used a session from the customer's package. Restoring it adds one session back to their remaining balance — no money is involved.",
    restoreQuestion: "Restore this package session?",
    refundedLine: "Refunded",
    sessionRestoredLine: "Session restored",
  },
  th: {
    title: "การจอง",
    description: "จัดการนัดหมายได้ทั้งแบบรายการ รายวัน รายสัปดาห์ และรายเดือน",
    showing: "กำลังแสดง:",
    clear: "ล้างตัวกรอง",
    noBookingsFilter: "ไม่มีรายการที่ตรงกับตัวกรองนี้",
    noBookingsYet: "ยังไม่มีการจอง",
    noBookingsDay: "วันนี้ไม่มีการจอง",
    prev: "← ก่อนหน้า",
    next: "ถัดไป →",
    unnamedCustomer: "ไม่ระบุชื่อลูกค้า",
    unnamed: "ไม่ระบุชื่อ",
    inPerson: "ชำระหน้างาน",
    complete: "เสร็จสิ้น",
    markComplete: "ทำเครื่องหมายว่าเสร็จ",
    markCompleteTitle: "ทำเครื่องหมายว่านัดนี้เสร็จแล้ว?",
    markCompleteDesc: "จะบันทึกว่านัดหมายนี้เสร็จเรียบร้อยแล้ว",
    noShow: "ไม่มาตามนัด",
    markNoShow: "ทำเครื่องหมายว่าไม่มา",
    markNoShowTitle: "ทำเครื่องหมายว่าลูกค้าไม่มาตามนัด?",
    markNoShowDesc: "จะบันทึกว่าลูกค้าไม่มาตามนัด โดยจะไม่ปลดล็อกเวลาหรือคืนเงินให้อัตโนมัติ",
    cancel: "ยกเลิก",
    cancelTitle: "ยกเลิกการจองนี้?",
    cancelDescBase: "การยกเลิกจะปลดล็อกช่วงเวลานี้ให้ว่างลง",
    cancelDescPayment: " ระบบจะไม่คืนเงินให้อัตโนมัติ",
    cancelBooking: "ยกเลิกการจอง",
    keepBooking: "ไม่ยกเลิก",
    save: "บันทึก",
    notePlaceholder: "โน้ต — เช่น ลูกค้า VIP ต้องดูแลเป็นพิเศษ",
    flag: "ปักหมุด",
    freeBooking: "จองฟรี",
    paid: "ชำระแล้ว",
    notYetPaid: "ยังไม่ชำระ",
    viewList: "รายการ",
    viewDay: "วัน",
    viewWeek: "สัปดาห์",
    viewMonth: "เดือน",
    catAll: "ทั้งหมด",
    catPaid: "ชำระแล้ว",
    catUnpaid: "ยังไม่ชำระ",
    catCompleted: "เสร็จสิ้น",
    catCancelled: "ยกเลิก",
    filterConfirmed: "ยืนยันแล้ว",
    filterUnpaid: "ยังไม่ชำระ",
    filterCancelledNoShow: "ยกเลิก/ไม่มาตามนัด",
    filterPaid: "ชำระแล้ว",
    filterCompleted: "เสร็จสิ้น",
    filterCancelled: "ยกเลิกแล้ว",
    newBooking: "จองใหม่",
    forPhoneEtc: "สำหรับการจองที่รับทางโทรศัพท์ LINE หรือลูกค้าเดินเข้ามาเอง",
    customerName: "ชื่อลูกค้า",
    phoneNumber: "เบอร์โทรศัพท์",
    emailOptional: "อีเมล (ไม่บังคับ)",
    noCharge: "ไม่คิดเงินสำหรับการจองนี้",
    creating: "กำลังสร้าง...",
    createBooking: "สร้างการจอง",
    close: "ปิด",
    refund: "คืนเงิน",
    full: "เต็มจำนวน",
    partial: "บางส่วน",
    continue: "ดำเนินการต่อ",
    refundNotice: "เงินจะถูกคืนไปยังช่องทางชำระเงินเดิมของลูกค้าผ่าน Stripe การดำเนินการนี้ไม่สามารถย้อนกลับได้จาก Velure",
    cashRefundNotice: "คิวนี้จ่ายเงินสดหน้าร้าน ไม่ได้ผ่าน Stripe — การกดนี้แค่บันทึกว่าคืนเงินให้ลูกค้าแล้ว ไม่มีเงินเคลื่อนไหวผ่านระบบจริง",
    back: "ย้อนกลับ",
    refunding: "กำลังคืนเงิน…",
    confirmRefund: "ยืนยันการคืนเงิน",
    restoreSession: "คืนสิทธิ์แพ็กเกจ",
    restoring: "กำลังคืนสิทธิ์…",
    confirmRestore: "ยืนยันการคืนสิทธิ์",
    restoreNotice: "คิวนี้ใช้สิทธิ์จากแพ็กเกจของลูกค้าไปแล้ว การคืนจะเพิ่มจำนวนครั้งกลับเข้ายอดคงเหลือของลูกค้า 1 ครั้ง ไม่มีเรื่องเงินเกี่ยวข้อง",
    restoreQuestion: "คืนสิทธิ์แพ็กเกจของคิวนี้?",
    refundedLine: "คืนเงินแล้ว",
    sessionRestoredLine: "คืนสิทธิ์แพ็กเกจแล้ว",
  },
};

export function tPaidLine(locale: Locale, amountSatang: number, paidBaht: string, hasPayment: boolean): string {
  if (amountSatang <= 0) return bookingsText[locale].freeBooking;
  return hasPayment
    ? `${paidBaht} ${bookingsText[locale].paid}`
    : `${paidBaht} ${bookingsText[locale].notYetPaid}`;
}

export function tRefundQuestion(locale: Locale, amount: string): string {
  return locale === "th" ? `คืนเงิน ${amount}?` : `Refund ${amount}?`;
}

export function tFullAmount(locale: Locale, amount: string): string {
  return locale === "th" ? `เต็มจำนวน (${amount})` : `Full (${amount})`;
}

export function tPaidRefunding(locale: Locale, paidAmount: string, refundAmount: string): string {
  return locale === "th"
    ? `${paidAmount} · กำลังคืน ${refundAmount}`
    : `${paidAmount} paid · refunding ${refundAmount}`;
}

export function tMoreCount(locale: Locale, count: number): string {
  return locale === "th" ? `อีก ${count} รายการ` : `+${count} more`;
}

function formatShortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(iso));
}

// Shown on a REFUNDED/PARTIALLY_REFUNDED booking's row — amountBaht is
// already formatted (formatBaht), so this only composes the line + date.
// null amount means a package-session restore (no money involved).
export function tRefundedLine(locale: Locale, amountBaht: string | null, dateISO: string): string {
  const t = bookingsText[locale];
  const date = formatShortDate(dateISO, locale);
  if (amountBaht === null) return `${t.sessionRestoredLine} · ${date}`;
  return `${t.refundedLine} ${amountBaht} · ${date}`;
}

// --- Calendar page ---

export const calendarText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Calendar",
    description: "Your team's day, week, and month, side by side.",
    viewDay: "Day",
    viewWeek: "Week",
    viewMonth: "Month",
    today: "Today",
    prev: "← Prev",
    next: "Next →",
    noBookingsDay: "No bookings on this day.",
    closedOnThisDay: "Closed on this day — change your hours on the",
    settingsPage: "Settings",
    pageSuffix: "page.",
    addTeamMember: "Add a team member to see their schedule here.",
    goToTeam: "Go to Team",
    soon: "Soon",
    pendingDetails: "Pending details",
    walkIn: "Walk-in",
    unnamedCustomer: "Unnamed customer",
    room: "Room",
    booked: "booked",
    attendees: "Attendees",
    noOneBookedTooltip: "No one booked yet",
    reminders: "Reminders",
    class: "Class",
    noteAndFlag: "Note & flag",
    noOneBookedYet: "No one booked yet.",
    flag: "Flag",
    save: "Save",
    notePlaceholder: "e.g. VIP attendee, needs extra care",
  },
  th: {
    title: "ปฏิทิน",
    description: "ตารางงานทั้งทีมแบบรายวัน รายสัปดาห์ และรายเดือน ดูพร้อมกันได้ในที่เดียว",
    viewDay: "วัน",
    viewWeek: "สัปดาห์",
    viewMonth: "เดือน",
    today: "วันนี้",
    prev: "← ก่อนหน้า",
    next: "ถัดไป →",
    noBookingsDay: "วันนี้ไม่มีการจอง",
    closedOnThisDay: "ร้านปิดวันนี้ — เปลี่ยนเวลาเปิด-ปิดได้ที่หน้า",
    settingsPage: "ตั้งค่า",
    pageSuffix: "",
    addTeamMember: "เพิ่มพนักงานก่อน เพื่อดูตารางงานของพวกเขาที่นี่",
    goToTeam: "ไปที่หน้าพนักงาน",
    soon: "ใกล้ถึง",
    pendingDetails: "รอกรอกรายละเอียด",
    walkIn: "ลูกค้าเดินเข้ามา",
    unnamedCustomer: "ไม่ระบุชื่อลูกค้า",
    room: "ห้อง",
    booked: "จองแล้ว",
    attendees: "ผู้เข้าร่วม",
    noOneBookedTooltip: "ยังไม่มีคนจอง",
    reminders: "รายการที่ต้องจำ",
    class: "คลาส",
    noteAndFlag: "โน้ต & ปักหมุด",
    noOneBookedYet: "ยังไม่มีคนจอง",
    flag: "ปักหมุด",
    save: "บันทึก",
    notePlaceholder: "เช่น ผู้เข้าร่วม VIP ต้องดูแลเป็นพิเศษ",
  },
};

// --- Customers ---

export const customersText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Customers",
    description: "Everyone who has booked with you.",
    searchPlaceholder: "Search by name, phone, or email…",
    allTags: "All tags",
    filter: "Filter",
    noCustomersFilter: "No customers match that search.",
    noCustomersYet: "No customers yet — they'll show up here after a booking.",
    colName: "Name",
    colTags: "Tags",
    colLastVisit: "Last visit",
    colBookings: "Bookings",
    colTotalSpend: "Total spend",
    noContactInfo: "No contact info on file",
    never: "Never",
    backToCustomers: "← Customers",
    totalSpend: "Total spend",
    visits: "Visits",
    noShows: "No-shows",
    lastVisit: "Last visit",
    notes: "Notes",
    tags: "Tags",
    upcoming: "Upcoming",
    noUpcomingBookings: "No upcoming bookings.",
    history: "History",
    noPastBookings: "No past bookings yet.",
    save: "Save",
    notesPlaceholder: "e.g. Prefers afternoon slots, allergic to lavender oil",
    tagsPlaceholder: "One tag per line, e.g.\nVIP\nPrefers quiet room",
    packages: "Packages",
    noActivePackages: "No active packages.",
    sessionsLeftSuffix: "left",
    expires: "Expires",
    bookSession: "Book a session",
    booking: "Booking...",
    confirmBooking: "Confirm",
    cancelAction: "Cancel",
    sellAPackage: "Sell a package",
    noPackagesToSell: "No packages set up yet — add one from a service's page first.",
    paymentCash: "Cash",
    paymentCard: "Card",
    paymentPromptpay: "PromptPay",
    paymentOther: "Other",
    selling: "Selling...",
    sellPackage: "Sell package",
  },
  th: {
    title: "ลูกค้า",
    description: "รายชื่อลูกค้าทุกคนที่เคยจองกับร้าน",
    searchPlaceholder: "ค้นหาด้วยชื่อ เบอร์โทร หรืออีเมล…",
    allTags: "ทุกแท็ก",
    filter: "กรอง",
    noCustomersFilter: "ไม่พบลูกค้าที่ตรงกับการค้นหา",
    noCustomersYet: "ยังไม่มีลูกค้า — รายชื่อจะขึ้นที่นี่หลังมีการจอง",
    colName: "ชื่อ",
    colTags: "แท็ก",
    colLastVisit: "มาล่าสุด",
    colBookings: "จำนวนครั้งที่จอง",
    colTotalSpend: "ยอดใช้จ่ายรวม",
    noContactInfo: "ไม่มีข้อมูลติดต่อ",
    never: "ยังไม่เคยมา",
    backToCustomers: "← ลูกค้า",
    totalSpend: "ยอดใช้จ่ายรวม",
    visits: "จำนวนครั้งที่มา",
    noShows: "ไม่มาตามนัด",
    lastVisit: "มาล่าสุด",
    notes: "โน้ต",
    tags: "แท็ก",
    upcoming: "การจองที่กำลังจะถึง",
    noUpcomingBookings: "ไม่มีการจองที่กำลังจะถึง",
    history: "ประวัติการจอง",
    noPastBookings: "ยังไม่มีประวัติการจอง",
    save: "บันทึก",
    notesPlaceholder: "เช่น ชอบช่วงบ่าย แพ้น้ำมันลาเวนเดอร์",
    tagsPlaceholder: "แท็กละบรรทัด เช่น\nลูกค้า VIP\nชอบห้องเงียบ",
    packages: "แพ็กเกจ",
    noActivePackages: "ไม่มีแพ็กเกจที่ใช้ได้อยู่",
    sessionsLeftSuffix: "เหลือ",
    expires: "หมดอายุ",
    bookSession: "จองคิวจากแพ็กเกจนี้",
    booking: "กำลังจอง...",
    confirmBooking: "ยืนยัน",
    cancelAction: "ยกเลิก",
    sellAPackage: "ขายแพ็กเกจ",
    noPackagesToSell: "ยังไม่มีแพ็กเกจให้ขาย — ไปเพิ่มที่หน้าบริการก่อน",
    paymentCash: "เงินสด",
    paymentCard: "บัตร",
    paymentPromptpay: "พร้อมเพย์",
    paymentOther: "อื่นๆ",
    selling: "กำลังบันทึก...",
    sellPackage: "ขายแพ็กเกจ",
  },
};

export function tCustomerCount(locale: Locale, count: number): string {
  if (locale === "th") return `ลูกค้า ${count} คน`;
  return `${count} customer${count === 1 ? "" : "s"}`;
}

export function tNoShowCount(locale: Locale, count: number): string {
  if (locale === "th") return `ไม่มา ${count} ครั้ง`;
  return `${count} no-show${count === 1 ? "" : "s"}`;
}

// --- Services ---

export const servicesText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Services",
    description: "What customers can book on your public booking page.",
    noServicesYet: "No services yet — add your first one to get started.",
    addService: "+ Add service",
    addServiceButton: "Add service",
    addServiceTitle: "Add a service",
    close: "Close",
    serviceName: "Service name",
    durationMin: "Duration (min)",
    bufferMin: "Buffer (min)",
    priceThb: "Price (THB)",
    fullPayment: "Full payment",
    deposit: "Deposit",
    free: "Free",
    depositAmountThb: "Deposit amount (THB)",
    depositFixed: "Fixed amount",
    depositPercentOption: "Percent of price",
    depositPercentPlaceholder: "Deposit percent, e.g. 50",
    paymentMode: "Payment",
    capacitySeatsLabel: "Capacity (seats) — leave blank for a regular 1:1 service",
    capacityPlaceholder: "e.g. 10 for a class",
    adding: "Adding...",
    minSuffix: "min",
    edit: "Edit",
    delete: "Delete",
    description_: "Description",
    descriptionPlaceholder:
      "What customers see on your booking page — what's included, what to expect, anything to prepare.",
    photoUrl: "Photo URL",
    capacitySeats: "Capacity (seats)",
    capacityEditPlaceholder: "Leave blank for a regular 1:1 service",
    capacityHint:
      "Only affects sessions scheduled after you save — sessions already on the calendar keep their original capacity.",
    saving: "Saving...",
    saveDetails: "Save details",
    bookingFormQuestions: "Booking form questions",
    bookingFormHint:
      "Extra questions customers answer when booking this service. Mark ones that must be filled in to submit as required.",
    optional: "Optional",
    important: "Important",
    requiredToSubmit: "Required to submit",
    remove: "Remove",
    noExtraQuestionsYet: "No extra questions yet.",
    fieldPlaceholder: "e.g. Any allergies?",
    add: "Add",
    packages: "Packages",
    packagesHint:
      "Bundles of sessions customers can buy up front and redeem later — sold in person from a customer's own page.",
    noPackagesYet: "No packages yet.",
    packageNamePlaceholder: "Package name, e.g. 10-session pass",
    sessionsSuffix: "sessions",
    daysSuffix: "days",
    priceBaht: "Price (THB)",
    validityDaysPlaceholder: "Expires in (days, optional)",
  },
  th: {
    title: "บริการ",
    description: "รายการบริการที่ลูกค้าจองได้จากหน้าเว็บจองคิว",
    noServicesYet: "ยังไม่มีบริการ — เพิ่มรายการแรกเพื่อเริ่มใช้งาน",
    addService: "+ เพิ่มบริการ",
    addServiceButton: "เพิ่มบริการ",
    addServiceTitle: "เพิ่มบริการ",
    close: "ปิด",
    serviceName: "ชื่อบริการ",
    durationMin: "ระยะเวลา (นาที)",
    bufferMin: "เวลาพัก (นาที)",
    priceThb: "ราคา (บาท)",
    fullPayment: "ชำระเต็มจำนวน",
    deposit: "มัดจำ",
    free: "ฟรี",
    depositAmountThb: "จำนวนเงินมัดจำ (บาท)",
    depositFixed: "จำนวนเงินคงที่",
    depositPercentOption: "เปอร์เซ็นต์ของราคา",
    depositPercentPlaceholder: "เปอร์เซ็นต์มัดจำ เช่น 50",
    paymentMode: "การชำระเงิน",
    capacitySeatsLabel: "จำนวนที่นั่ง — เว้นว่างไว้หากเป็นบริการแบบตัวต่อตัว",
    capacityPlaceholder: "เช่น 10 สำหรับคลาส",
    adding: "กำลังเพิ่ม...",
    minSuffix: "นาที",
    edit: "แก้ไข",
    delete: "ลบ",
    description_: "รายละเอียด",
    descriptionPlaceholder: "สิ่งที่ลูกค้าจะเห็นในหน้าจองคิว เช่น บริการนี้มีอะไรบ้าง ต้องเตรียมตัวอย่างไร",
    photoUrl: "ลิงก์รูปภาพ",
    capacitySeats: "จำนวนที่นั่ง",
    capacityEditPlaceholder: "เว้นว่างไว้หากเป็นบริการแบบตัวต่อตัว",
    capacityHint:
      "มีผลเฉพาะรอบที่จองใหม่หลังบันทึก — รอบที่มีอยู่ในปฏิทินแล้วจะยังใช้จำนวนที่นั่งเดิม",
    saving: "กำลังบันทึก...",
    saveDetails: "บันทึกรายละเอียด",
    bookingFormQuestions: "คำถามในฟอร์มจอง",
    bookingFormHint: "คำถามเพิ่มเติมที่ลูกค้าต้องตอบตอนจองบริการนี้ ตั้งค่าให้เป็นคำถามบังคับได้หากจำเป็น",
    optional: "ไม่บังคับ",
    important: "สำคัญ",
    requiredToSubmit: "บังคับตอบ",
    remove: "ลบ",
    noExtraQuestionsYet: "ยังไม่มีคำถามเพิ่มเติม",
    fieldPlaceholder: "เช่น มีอาการแพ้อะไรไหม",
    add: "เพิ่ม",
    packages: "แพ็กเกจ",
    packagesHint: "ชุดสิทธิ์ที่ลูกค้าซื้อล่วงหน้าแล้วทยอยใช้ทีหลังได้ — ขายที่หน้าโปรไฟล์ลูกค้าแต่ละคน",
    noPackagesYet: "ยังไม่มีแพ็กเกจ",
    packageNamePlaceholder: "ชื่อแพ็กเกจ เช่น แพ็ก 10 ครั้ง",
    sessionsSuffix: "ครั้ง",
    daysSuffix: "วัน",
    priceBaht: "ราคา (บาท)",
    validityDaysPlaceholder: "หมดอายุใน (วัน, ไม่บังคับ)",
  },
};

export function tClassSeats(locale: Locale, seats: number): string {
  if (locale === "th") return `คลาส · ${seats} ที่นั่ง`;
  return `Class · ${seats} seats`;
}

export function tMinBuffer(locale: Locale, minutes: number): string {
  if (locale === "th") return ` + เวลาพัก ${minutes} นาที`;
  return ` + ${minutes} min buffer`;
}

export function tDepositPercentLabel(locale: Locale, percent: number): string {
  if (locale === "th") return `มัดจำ ${percent}%`;
  return `Deposit ${percent}%`;
}

// --- Team ---

export const teamText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Team",
    description: "Staff who can be booked for your services.",
    noTeamYet: "No team members yet — add your first one to get started.",
    addTeamMember: "+ Add team member",
    addTeamMemberButton: "Add team member",
    addTeamMemberTitle: "Add a team member",
    close: "Close",
    name: "Name",
    canPerform: "Can perform",
    adding: "Adding...",
    noServicesAssigned: "No services assigned",
    hours: "Hours",
    delete: "Delete",
    deleting: "Deleting…",
    deleteStaffTitle: "Delete",
    deleteStaffDesc:
      "This removes them from Team and unassigns them from any services. Staff with any booking history — including past or cancelled bookings — can't be deleted, to keep existing reports accurate.",
    workingHours: "Working hours & breaks",
    off: "Off",
    to: "to",
    break: "break",
    saving: "Saving...",
    saveHours: "Save hours",
    blockedTime: "Blocked time",
    blockedTimeHint:
      "Lunch, a meeting, or anything else that should make this person unbookable without creating a fake booking.",
    remove: "Remove",
    noUpcomingBlocks: "No upcoming blocks.",
    reasonOptional: "Reason (optional)",
    addBlock: "Add block",
    sunday: "Sunday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
  },
  th: {
    title: "พนักงาน",
    description: "รายชื่อพนักงานที่ลูกค้าจองคิวได้",
    noTeamYet: "ยังไม่มีพนักงาน — เพิ่มคนแรกเพื่อเริ่มใช้งาน",
    addTeamMember: "+ เพิ่มพนักงาน",
    addTeamMemberButton: "เพิ่มพนักงาน",
    addTeamMemberTitle: "เพิ่มพนักงาน",
    close: "ปิด",
    name: "ชื่อ",
    canPerform: "ให้บริการได้",
    adding: "กำลังเพิ่ม...",
    noServicesAssigned: "ยังไม่ได้กำหนดบริการ",
    hours: "เวลาทำงาน",
    delete: "ลบ",
    deleting: "กำลังลบ…",
    deleteStaffTitle: "ลบ",
    deleteStaffDesc:
      "การลบจะเอาชื่อออกจากหน้าพนักงานและยกเลิกการผูกกับบริการทั้งหมด พนักงานที่มีประวัติการจอง — รวมถึงการจองที่ผ่านมาหรือถูกยกเลิก — จะลบไม่ได้ เพื่อให้รายงานที่มีอยู่ถูกต้อง",
    workingHours: "เวลาทำงาน & เวลาพัก",
    off: "วันหยุด",
    to: "ถึง",
    break: "พัก",
    saving: "กำลังบันทึก...",
    saveHours: "บันทึกเวลาทำงาน",
    blockedTime: "ช่วงเวลาที่ไม่ว่าง",
    blockedTimeHint: "เช่น เวลาพักเที่ยง ประชุม หรือช่วงอื่นที่ไม่ต้องการให้ลูกค้าจอง โดยไม่ต้องสร้างการจองปลอม",
    remove: "ลบ",
    noUpcomingBlocks: "ไม่มีช่วงเวลาที่ถูกกันไว้",
    reasonOptional: "เหตุผล (ไม่บังคับ)",
    addBlock: "เพิ่มช่วงเวลา",
    sunday: "วันอาทิตย์",
    monday: "วันจันทร์",
    tuesday: "วันอังคาร",
    wednesday: "วันพุธ",
    thursday: "วันพฤหัสบดี",
    friday: "วันศุกร์",
    saturday: "วันเสาร์",
  },
};

export function tDeleteStaffTitle(locale: Locale, name: string): string {
  if (locale === "th") return `ลบ ${name}?`;
  return `Delete ${name}?`;
}

// --- Classes ---

export const classesText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Classes",
    description: "Scheduled sessions for your multi-seat services — customers book a seat, up to capacity.",
    notSetUpTitle: "Classes aren’t set up yet",
    notSetUpDesc:
      "Set a service’s capacity to 2 or more on the Services page to turn it into a class, then come back here to schedule sessions for it.",
    goToServices: "Go to Services",
    noUpcomingSessions: "No upcoming sessions yet — schedule one below.",
    booked: "booked",
    cancelSession: "Cancel session",
    cancelling: "Cancelling…",
    cancelSessionTitle: "Cancel this session?",
    removeSession: "Remove",
    removing: "Removing…",
    removeSessionTitle: "Remove this session?",
    removeSessionDesc:
      "This removes the session from the schedule. Sessions with any booking history — including past or cancelled bookings — can't be removed, to keep existing reports accurate.",
    noteAndFlag: "Note & flag",
    notePlaceholder: "e.g. VIP attendee, needs extra care",
    flag: "Flag",
    save: "Save",
    scheduleSession: "Schedule a session",
    repeatWeekly: "Repeat weekly (optional)",
    repeatUntil: "Repeat until",
    repeatHint:
      "Creates one session on every checked day of the week between the start date above and “Repeat until”. Leave this closed for a single one-off session.",
    noRoom: "No room / studio",
    scheduling: "Scheduling...",
    scheduleSessionButton: "Schedule session",
    addTeamMemberFirst: "Add a team member first on the Team page.",
    sun: "Sun",
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
  },
  th: {
    title: "คลาส",
    description: "รอบเรียนสำหรับบริการแบบหลายที่นั่ง — ลูกค้าจองที่นั่งได้จนกว่าจะเต็ม",
    notSetUpTitle: "ยังไม่ได้ตั้งค่าคลาส",
    notSetUpDesc:
      "ตั้งจำนวนที่นั่งของบริการให้เป็น 2 ที่นั่งขึ้นไปในหน้าบริการก่อน เพื่อให้กลายเป็นคลาส แล้วกลับมาที่นี่เพื่อกำหนดรอบเรียน",
    goToServices: "ไปที่หน้าบริการ",
    noUpcomingSessions: "ยังไม่มีรอบเรียนที่กำลังจะถึง — กำหนดรอบใหม่ได้ด้านล่าง",
    booked: "จองแล้ว",
    cancelSession: "ยกเลิกรอบเรียน",
    cancelling: "กำลังยกเลิก…",
    cancelSessionTitle: "ยกเลิกรอบเรียนนี้หรือไม่?",
    removeSession: "ลบ",
    removing: "กำลังลบ…",
    removeSessionTitle: "ลบรอบเรียนนี้หรือไม่?",
    removeSessionDesc:
      "การลบจะเอารอบเรียนนี้ออกจากตาราง รอบเรียนที่มีประวัติการจอง — รวมถึงการจองที่ผ่านมาหรือถูกยกเลิก — จะลบไม่ได้ เพื่อให้รายงานที่มีอยู่ถูกต้อง",
    noteAndFlag: "โน้ต & ปักหมุด",
    notePlaceholder: "เช่น ผู้เข้าร่วม VIP ต้องดูแลเป็นพิเศษ",
    flag: "ปักหมุด",
    save: "บันทึก",
    scheduleSession: "กำหนดรอบเรียน",
    repeatWeekly: "ทำซ้ำทุกสัปดาห์ (ไม่บังคับ)",
    repeatUntil: "ทำซ้ำจนถึง",
    repeatHint:
      "จะสร้างรอบเรียนในทุกวันที่เลือกไว้ ตั้งแต่วันที่เริ่มต้นด้านบนจนถึงวันที่ “ทำซ้ำจนถึง” ปล่อยส่วนนี้ไว้หากต้องการสร้างรอบเรียนแบบครั้งเดียว",
    noRoom: "ไม่ระบุห้อง",
    scheduling: "กำลังบันทึก...",
    scheduleSessionButton: "กำหนดรอบเรียน",
    addTeamMemberFirst: "กรุณาเพิ่มพนักงานที่หน้าพนักงานก่อน",
    sun: "อา",
    mon: "จ",
    tue: "อ",
    wed: "พ",
    thu: "พฤ",
    fri: "ศ",
    sat: "ส",
  },
};

export function tCancelSessionDesc(locale: Locale, seatsBooked: number): string {
  if (locale === "th") return `การยกเลิกจะทำให้ผู้เข้าร่วมที่จองไว้ทั้ง ${seatsBooked} คนถูกยกเลิกและได้รับอีเมลแจ้งเตือน — รอบเรียนยังคงอยู่ในตารางพร้อมประวัติเดิม`;
  return `This cancels all ${seatsBooked} booked attendee${seatsBooked === 1 ? "" : "s"} and emails each of them — the session stays on the schedule with its history intact.`;
}

// --- Resources ---

export const resourcesText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Resources",
    description: "Rooms, stations, or spaces customers and staff use — pick one to see its whole day at a glance.",
    closed: "(closed)",
    noResourcesYet: "No resources yet — add your first one, then assign it to a booking or class when you schedule one.",
    closedTemporarily: "Closed temporarily",
    today: "Today",
    prev: "← Prev",
    next: "Next →",
    closeTemporarily: "Close temporarily",
    reopen: "Reopen",
    removeResource: "Remove this resource",
    removing: "Removing…",
    removeResourceDesc:
      "This permanently removes the room. Rooms with upcoming classes or bookings can't be removed — move or cancel those first, or use Close temporarily instead if this is just a short break.",
    remove: "Remove",
    close: "Close",
    addResource: "+ Add resource",
    addResourceButton: "Add resource",
    namePlaceholder: "e.g. Treatment Room 1",
    adding: "Adding...",
    closedOnThisDay: "Closed on this day.",
    open: "Open",
    free: "Free",
    class: "Class",
    booked: "booked",
    unnamedCustomer: "Unnamed customer",
  },
  th: {
    title: "ห้อง",
    description: "ห้อง สเตชัน หรือพื้นที่ที่ลูกค้าและพนักงานใช้งาน — เลือกดูตารางทั้งวันของแต่ละที่ได้ที่นี่",
    closed: "(ปิดอยู่)",
    noResourcesYet: "ยังไม่มีห้อง — เพิ่มห้องแรก แล้วเลือกใช้กับการจองหรือคลาสได้ทันที",
    closedTemporarily: "ปิดชั่วคราว",
    today: "วันนี้",
    prev: "← ก่อนหน้า",
    next: "ถัดไป →",
    closeTemporarily: "ปิดชั่วคราว",
    reopen: "เปิดใช้งานอีกครั้ง",
    removeResource: "ลบห้องนี้",
    removing: "กำลังลบ…",
    removeResourceDesc:
      "การลบจะเอาห้องนี้ออกอย่างถาวร ห้องที่มีคลาสหรือการจองในอนาคตจะลบไม่ได้ — ย้ายหรือยกเลิกก่อน หรือใช้ปุ่มปิดชั่วคราวแทนหากแค่ต้องการพักใช้งานสั้นๆ",
    remove: "ลบ",
    close: "ปิด",
    addResource: "+ เพิ่มห้อง",
    addResourceButton: "เพิ่มห้อง",
    namePlaceholder: "เช่น ห้องทรีตเมนต์ 1",
    adding: "กำลังเพิ่ม...",
    closedOnThisDay: "ร้านปิดวันนี้",
    open: "เปิด",
    free: "ว่าง",
    class: "คลาส",
    booked: "จองแล้ว",
    unnamedCustomer: "ไม่ระบุชื่อลูกค้า",
  },
};

export function tRemoveResourceTitle(locale: Locale, name: string): string {
  if (locale === "th") return `ลบ ${name}?`;
  return `Remove ${name}?`;
}

// --- Waitlist ---

export const waitlistText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Waitlist",
    description:
      "Customers who asked to be notified when a slot opens. When a booking for their service and date is cancelled, the longest-waiting person is emailed/messaged automatically — this list is for visibility and cleanup, not action.",
    noEntries: "No one is waiting right now.",
    waiting: "Waiting",
    notified: "Notified",
    notifiedVia: "Notified via",
    remove: "Remove",
    removing: "Removing…",
    removeTitle: "Remove this waitlist entry?",
    removeDesc: "The customer won't be notified if a spot opens on this day anymore.",
  },
  th: {
    title: "รอคิว",
    description:
      "รายชื่อลูกค้าที่ฝากไว้ให้แจ้งเตือนเมื่อมีคิวว่าง — เมื่อมีคนยกเลิกคิวของบริการ/วันเดียวกัน ระบบจะส่งอีเมล/ข้อความให้คนที่ฝากไว้นานที่สุดโดยอัตโนมัติ รายการนี้มีไว้ดูสถานะและล้างข้อมูลเก่าเท่านั้น ไม่ต้องกดอะไรเพิ่ม",
    noEntries: "ตอนนี้ยังไม่มีใครฝากคิวไว้",
    waiting: "รออยู่",
    notified: "แจ้งเตือนแล้ว",
    notifiedVia: "แจ้งผ่าน",
    remove: "ลบ",
    removing: "กำลังลบ…",
    removeTitle: "ลบรายการรอคิวนี้?",
    removeDesc: "ลูกค้าคนนี้จะไม่ได้รับแจ้งเตือนอีกแม้มีคิวว่างในวันนี้",
  },
};

// --- Settings: Payments tab ---
//
// Only this tab is translated so far — Business/Hours/WhatsApp still
// hardcode English (see their own files). Deliberate, incremental scoping
// rather than a half-finished whole-page pass; extend the same way when
// those get their turn.

export const paymentsSettingsText: Record<Locale, Record<string, string>> = {
  en: {
    stripeHeading: "Stripe",
    connectIntro:
      "Connect a Stripe account to accept PromptPay and card payments — money goes straight to your own account, Velure never holds it.",
    connectStripe: "Connect Stripe",
    connectedReady: "Connected — ready to accept payments.",
    connectedIncomplete:
      "Connected but incomplete — Stripe needs a bit more information before you can accept payments.",
    finishSetup: "Finish setup",
    waysToPay: "Ways customers can pay",
    card: "Card",
    promptpay: "PromptPay",
    cash: "Cash (pay in person)",
    needsStripe: "(needs Stripe connected above)",
    save: "Save",
    saving: "Saving...",
    atLeastOneMethod: "Turn on at least one payment method, or customers won't be able to pay for anything.",
    policyHeading: "Cancellation & reschedule policy",
    policyIntro:
      "How far in advance a customer can cancel or reschedule their own booking through the manage link — shown to customers before they pay.",
    rescheduleCutoffLabel: "Reschedule cutoff (hours before appointment)",
    cancelCutoffLabel: "Cancel cutoff (hours before appointment)",
    savePolicy: "Save policy",
    savingPolicy: "Saving...",
  },
  th: {
    stripeHeading: "Stripe",
    connectIntro:
      "เชื่อมบัญชี Stripe เพื่อรับเงินผ่าน PromptPay และบัตร — เงินเข้าบัญชีร้านโดยตรง Velure ไม่ถือเงินไว้เอง",
    connectStripe: "เชื่อม Stripe",
    connectedReady: "เชื่อมต่อแล้ว — พร้อมรับเงิน",
    connectedIncomplete: "เชื่อมต่อแล้วแต่ข้อมูลยังไม่ครบ — Stripe ต้องการข้อมูลเพิ่มเติมก่อนจะรับเงินได้",
    finishSetup: "กรอกข้อมูลให้ครบ",
    waysToPay: "ช่องทางที่ลูกค้าจ่ายเงินได้",
    card: "บัตร",
    promptpay: "พร้อมเพย์",
    cash: "เงินสด (จ่ายหน้าร้าน)",
    needsStripe: "(ต้องเชื่อม Stripe ก่อน)",
    save: "บันทึก",
    saving: "กำลังบันทึก...",
    atLeastOneMethod: "ต้องเปิดอย่างน้อย 1 ช่องทาง ไม่งั้นลูกค้าจะจ่ายเงินไม่ได้เลย",
    policyHeading: "นโยบายยกเลิก/เลื่อนนัด",
    policyIntro:
      "ลูกค้าต้องยกเลิกหรือเลื่อนนัดของตัวเองผ่านลิงก์จัดการคิวล่วงหน้ากี่ชั่วโมง — ลูกค้าจะเห็นนโยบายนี้ก่อนจ่ายเงิน",
    rescheduleCutoffLabel: "เลื่อนนัดได้ล่วงหน้าอย่างน้อย (ชั่วโมง)",
    cancelCutoffLabel: "ยกเลิกได้ล่วงหน้าอย่างน้อย (ชั่วโมง)",
    savePolicy: "บันทึกนโยบาย",
    savingPolicy: "กำลังบันทึก...",
  },
};

// --- Reports ---

export const reportsText: Record<Locale, Record<string, string>> = {
  en: {
    title: "Reports",
    thisWeek: "This week",
    thisMonth: "This month",
    thisYear: "This year",
    allTime: "All time",
    exportCsv: "Export CSV",
    settledBookings: "Settled bookings",
    revenue: "Revenue",
    avgBookingValue: "Avg. booking value",
    cancellationRate: "Cancellation rate",
    byTeamMember: "By team member",
    byService: "By service",
    noDataForRange: "No data for this range.",
    name: "Name",
    bookings: "Bookings",
    bookingsUnit: "bookings",
    print: "Print",
  },
  th: {
    title: "รายงาน",
    thisWeek: "สัปดาห์นี้",
    thisMonth: "เดือนนี้",
    thisYear: "ปีนี้",
    allTime: "ทั้งหมด",
    exportCsv: "ส่งออก CSV",
    settledBookings: "การจองที่เสร็จสิ้น",
    revenue: "รายได้",
    avgBookingValue: "มูลค่าเฉลี่ยต่อการจอง",
    cancellationRate: "อัตราการยกเลิก",
    byTeamMember: "แยกตามพนักงาน",
    byService: "แยกตามบริการ",
    noDataForRange: "ไม่มีข้อมูลในช่วงนี้",
    name: "ชื่อ",
    bookings: "จำนวนครั้งที่จอง",
    bookingsUnit: "ครั้ง",
    print: "พิมพ์",
  },
};

export function tRevenueBookingsDesc(locale: Locale, label: string): string {
  if (locale === "th") return `ผลประกอบการและการจอง — ${label}`;
  return `Revenue and bookings, ${label.toLowerCase()}.`;
}

export function tCancelledNoShow(locale: Locale, cancelled: number, noShow: number): string {
  if (locale === "th") return `ยกเลิก ${cancelled} · ไม่มาตามนัด ${noShow}`;
  return `${cancelled} cancelled · ${noShow} no-show`;
}
