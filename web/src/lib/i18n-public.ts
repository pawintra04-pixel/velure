import type { Locale } from "@/lib/i18n";

// Public-facing translations: the customer booking funnel (/book/*) and the
// owner login/signup screens. Kept apart from lib/i18n.ts (the dashboard's
// dictionary) because a different person picks the language here — the
// visitor, via the velure_locale cookie (lib/visitor-locale.ts) — rather
// than a logged-in owner's saved preference.

export function intlLocale(locale: Locale): string {
  return locale === "th" ? "th-TH" : "en-US";
}

export const publicText = {
  en: {
    // Header / shared
    myBookings: "My bookings",
    logIn: "Log in",
    service: "Service",
    staff: "Staff",
    time: "Time",
    amount: "Amount",
    status: "Status",
    genericError: "Something went wrong. Please try again.",
    processing: "Processing...",
    reserving: "Reserving...",
    free: "Free",
    // Services list
    chooseService: "Choose a service",
    noServices: "No services available yet.",
    depositNote: "Deposits (where shown) are part of the total price, not an extra charge.",
    deposit: "Deposit",
    fullPrice: "full price",
    // Service page
    freeNoPayment: "Free — no payment required.",
    depositDueNow: "Deposit due now",
    restOnArrival: "the rest is paid on arrival.",
    ofFullPrice: "of the full price",
    fullPaymentDueNow: "Full payment due now",
    // Time picker
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    availableTimes: "Available times",
    reserveInstantly: "Reserve instantly",
    slotTaken: "That time slot was just taken — please choose another.",
    tooManyHolds:
      "You already have a couple of reservations in progress — complete or let one expire before reserving another.",
    noTimesThisDay: "No available times on this day",
    notifyMe: "Notify me if a spot opens",
    waitlistIntro: "We'll text or email you if someone cancels on this day.",
    yourName: "Your name",
    phoneNumber: "Phone number",
    emailOptional: "Email (optional)",
    joining: "Joining...",
    joinWaitlist: "Join waitlist",
    waitlistJoined: "You're on the list — we'll let you know if a spot opens on this day.",
    nameAndPhoneRequired: "Name and phone are required.",
    // Class picker
    upcomingSessions: "Upcoming sessions",
    noUpcomingSessions: "No upcoming sessions scheduled yet.",
    full: "Full",
    reserveSeat: "Reserve a seat",
    classFull: "That session just filled up — please pick another.",
    // Details
    holdExpiredTitle: "This hold has expired",
    holdExpiredDesc: "Reservations are held for 10 minutes. Please pick a new time.",
    chooseNewTime: "Choose a new time",
    almostDone: "Almost done",
    heldFor10: "Your slot is reserved for 10 minutes — complete your details to confirm it.",
    amountDue: "Amount due",
    yourDetails: "Your details",
    name: "Name",
    email: "Email",
    important: "Important",
    payWith: "Pay with",
    methodPromptpay: "PromptPay",
    methodCard: "Card",
    methodCash: "Cash (pay in person)",
    noPaymentMethod:
      "This business hasn't set up a way to accept payment yet — please contact them directly to book this.",
    continueToPayment: "Continue to payment",
    confirmBooking: "Confirm booking",
    holdExpiredWhileFilling: "Your reservation expired while filling this in. Please pick a new time.",
    fillRequired: "Please fill in all required fields.",
    // Pay
    payWithCard: "Pay with card",
    couldNotLoadPayment: "Could not load payment form.",
    scanToPay: "Scan to pay",
    qrNotFound: "QR code not found — please try again",
    openPaymentPageTest: "Open payment page (test mode)",
    waitingForPayment: "Waiting for payment... this page will update automatically once paid.",
    cardNotConfigured: "Card payments are not configured.",
    payNow: "Pay now",
    paymentFailed: "Payment failed. Please try again.",
    // Confirmed
    bookingConfirmed: "Booking confirmed",
    amountDueCash: "Amount due (cash)",
    amountPaid: "Amount paid",
    needReschedule: "Need to reschedule or cancel?",
    createAccountCta: "Create an account to see all your bookings in one place",
    // Manage
    manageTitle: "Manage your booking",
    lineConnected: "✅ Connected — you'll get booking updates on LINE.",
    lineGetUpdates: "Get booking updates on LINE.",
    lineError: "Something went wrong connecting LINE — please try again.",
    connectLine: "Connect LINE",
    reschedule: "Reschedule",
    classNoReschedule: "Class bookings can't be rescheduled — cancel and book a different session instead.",
    cancelBooking: "Cancel booking",
    moveTitle: "Move this booking?",
    moving: "Moving…",
    moveBooking: "Move booking",
    moveDesc: "This replaces your current time. The old time will be freed up.",
    cancelTitle: "Cancel this booking?",
    cancelling: "Cancelling…",
    cancelFreesSlot: "Cancelling will free this time slot.",
    cancelNoRefundBefore: "Payment will",
    cancelNoRefundNot: "not",
    cancelNoRefundAfter: "automatically be refunded — contact the business if a refund is expected.",
    keepAsIs: "Keep as is",
    cancelledDone: "✓ Your booking has been cancelled.",
    freeBooking: "Free booking",
    // Customer accounts
    customerLoginTitle: "Log in",
    noAccount: "Don't have an account?",
    createOne: "Create one",
    createAccountTitle: "Create an account",
    haveAccount: "Already have an account?",
    password: "Password",
    passwordMin: "Password (min. 8 characters)",
    loggingIn: "Logging in...",
    creatingAccount: "Creating account...",
    createAccount: "Create account",
    logOut: "Log out",
    noBookingsYet: "No bookings yet —",
    bookSomething: "book something",
    // Legal footer
    legalAgreePrefix: "By booking you agree to the",
    terms: "Terms of Service",
    and: "and",
    privacy: "Privacy Policy",
    poweredBy: "Powered by Velure",
    // Owner auth screens
    ownerSignupTitle: "Create your business",
    ownerSignupSubtitle: "Start taking bookings in minutes.",
    businessName: "Business name",
    acceptTermsPrefix: "I agree to the",
    ownerLoginSubtitle: "Welcome back to Velure.",
    // Server action errors
    errAllFieldsRequired: "All fields are required.",
    errAcceptTerms: "Please accept the Terms of Service and Privacy Policy.",
    errPasswordShort: "Password must be at least 8 characters.",
    errEmailTaken: "An account with that email already exists.",
    errEmailTakenLogIn: "An account with that email already exists. Log in instead.",
    errEmailPasswordRequired: "Email and password are required.",
    errInvalidLogin: "Invalid email or password.",
    errNameEmailPasswordRequired: "Name, email, and password are required.",
    errPhoneOnFile: "That phone number is already on file with a different email.",
    errBookingNotFound: "Booking not found.",
    errCannotCancel: "This booking can no longer be cancelled.",
    errCannotReschedule: "This booking can no longer be rescheduled.",
    errAlreadyChanged: "This booking was already changed — please refresh and try again.",
    errTimeTaken: "That time was just taken — please pick another.",
  },
  th: {
    myBookings: "การจองของฉัน",
    logIn: "เข้าสู่ระบบ",
    service: "บริการ",
    staff: "ผู้ให้บริการ",
    time: "เวลา",
    amount: "ยอดเงิน",
    status: "สถานะ",
    genericError: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    processing: "กำลังดำเนินการ...",
    reserving: "กำลังจอง...",
    free: "ฟรี",
    chooseService: "เลือกบริการ",
    noServices: "ยังไม่มีบริการเปิดให้จอง",
    depositNote: "ยอดมัดจำ (ถ้ามี) เป็นส่วนหนึ่งของราคาเต็ม ไม่ใช่ค่าใช้จ่ายเพิ่ม",
    deposit: "มัดจำ",
    fullPrice: "ราคาเต็ม",
    freeNoPayment: "ฟรี — ไม่ต้องชำระเงิน",
    depositDueNow: "ชำระมัดจำตอนนี้",
    restOnArrival: "ส่วนที่เหลือชำระที่ร้าน",
    ofFullPrice: "จากราคาเต็ม",
    fullPaymentDueNow: "ชำระเต็มจำนวนตอนนี้",
    morning: "ช่วงเช้า",
    afternoon: "ช่วงบ่าย",
    evening: "ช่วงเย็น",
    availableTimes: "เวลาที่ว่าง",
    reserveInstantly: "จองทันที",
    slotTaken: "มีคนจองเวลานี้ไปแล้ว กรุณาเลือกเวลาอื่น",
    tooManyHolds: "คุณมีการจองที่ยังทำไม่เสร็จอยู่แล้ว กรุณาทำให้เสร็จหรือรอให้หมดเวลาก่อนจองเพิ่ม",
    noTimesThisDay: "วันนี้ไม่มีเวลาว่าง",
    notifyMe: "แจ้งฉันเมื่อมีคิวว่าง",
    waitlistIntro: "เราจะส่งข้อความหรืออีเมลแจ้งคุณ ถ้ามีคนยกเลิกในวันนี้",
    yourName: "ชื่อของคุณ",
    phoneNumber: "เบอร์โทรศัพท์",
    emailOptional: "อีเมล (ไม่บังคับ)",
    joining: "กำลังลงชื่อ...",
    joinWaitlist: "ลงชื่อรอคิว",
    waitlistJoined: "ลงชื่อรอคิวแล้ว — เราจะแจ้งคุณถ้ามีคิวว่างในวันนี้",
    nameAndPhoneRequired: "กรุณากรอกชื่อและเบอร์โทรศัพท์",
    upcomingSessions: "รอบที่เปิดให้จอง",
    noUpcomingSessions: "ยังไม่มีรอบที่เปิดให้จอง",
    full: "เต็ม",
    reserveSeat: "จองที่นั่ง",
    classFull: "รอบนี้เพิ่งเต็ม กรุณาเลือกรอบอื่น",
    holdExpiredTitle: "การจองชั่วคราวหมดเวลาแล้ว",
    holdExpiredDesc: "ระบบกันเวลาไว้ให้ 10 นาที กรุณาเลือกเวลาใหม่",
    chooseNewTime: "เลือกเวลาใหม่",
    almostDone: "อีกนิดเดียว",
    heldFor10: "ระบบกันเวลานี้ไว้ให้คุณ 10 นาที กรอกข้อมูลเพื่อยืนยันการจอง",
    amountDue: "ยอดที่ต้องชำระ",
    yourDetails: "ข้อมูลของคุณ",
    name: "ชื่อ",
    email: "อีเมล",
    important: "สำคัญ",
    payWith: "ชำระด้วย",
    methodPromptpay: "พร้อมเพย์",
    methodCard: "บัตร",
    methodCash: "เงินสด (ชำระที่ร้าน)",
    noPaymentMethod: "ร้านนี้ยังไม่ได้ตั้งค่าการรับชำระเงิน กรุณาติดต่อร้านโดยตรงเพื่อจอง",
    continueToPayment: "ไปหน้าชำระเงิน",
    confirmBooking: "ยืนยันการจอง",
    holdExpiredWhileFilling: "การจองหมดเวลาระหว่างกรอกข้อมูล กรุณาเลือกเวลาใหม่",
    fillRequired: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ",
    payWithCard: "ชำระด้วยบัตร",
    couldNotLoadPayment: "โหลดฟอร์มชำระเงินไม่สำเร็จ",
    scanToPay: "สแกนเพื่อชำระเงิน",
    qrNotFound: "ไม่พบ QR code กรุณาลองใหม่",
    openPaymentPageTest: "เปิดหน้าชำระเงิน (โหมดทดสอบ)",
    waitingForPayment: "กำลังรอการชำระเงิน... หน้านี้จะอัปเดตเองเมื่อชำระสำเร็จ",
    cardNotConfigured: "ยังไม่ได้ตั้งค่าการชำระด้วยบัตร",
    payNow: "ชำระเงิน",
    paymentFailed: "ชำระเงินไม่สำเร็จ กรุณาลองใหม่",
    bookingConfirmed: "ยืนยันการจองแล้ว",
    amountDueCash: "ยอดที่ต้องชำระ (เงินสด)",
    amountPaid: "ยอดที่ชำระแล้ว",
    needReschedule: "ต้องการเลื่อนหรือยกเลิก?",
    createAccountCta: "สร้างบัญชีเพื่อดูการจองทั้งหมดได้ในที่เดียว",
    manageTitle: "จัดการการจอง",
    lineConnected: "✅ เชื่อมต่อแล้ว — คุณจะได้รับข้อความแจ้งการจองทาง LINE",
    lineGetUpdates: "รับข้อความแจ้งการจองทาง LINE",
    lineError: "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่",
    connectLine: "เชื่อมต่อ LINE",
    reschedule: "เลื่อนเวลา",
    classNoReschedule: "การจองคลาสเลื่อนเวลาไม่ได้ กรุณายกเลิกแล้วจองรอบอื่นแทน",
    cancelBooking: "ยกเลิกการจอง",
    moveTitle: "ย้ายการจองนี้หรือไม่?",
    moving: "กำลังย้าย…",
    moveBooking: "ย้ายการจอง",
    moveDesc: "เวลาใหม่จะแทนที่เวลาเดิม และเวลาเดิมจะว่างให้คนอื่นจองได้",
    cancelTitle: "ยกเลิกการจองนี้หรือไม่?",
    cancelling: "กำลังยกเลิก…",
    cancelFreesSlot: "เมื่อยกเลิก เวลานี้จะว่างให้คนอื่นจองได้",
    cancelNoRefundBefore: "ระบบ",
    cancelNoRefundNot: "จะไม่",
    cancelNoRefundAfter: "คืนเงินให้อัตโนมัติ — กรุณาติดต่อร้านหากต้องการขอคืนเงิน",
    keepAsIs: "ไม่เปลี่ยน",
    cancelledDone: "✓ ยกเลิกการจองเรียบร้อยแล้ว",
    freeBooking: "การจองฟรี",
    customerLoginTitle: "เข้าสู่ระบบ",
    noAccount: "ยังไม่มีบัญชี?",
    createOne: "สร้างบัญชี",
    createAccountTitle: "สร้างบัญชี",
    haveAccount: "มีบัญชีอยู่แล้ว?",
    password: "รหัสผ่าน",
    passwordMin: "รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)",
    loggingIn: "กำลังเข้าสู่ระบบ...",
    creatingAccount: "กำลังสร้างบัญชี...",
    createAccount: "สร้างบัญชี",
    logOut: "ออกจากระบบ",
    noBookingsYet: "ยังไม่มีการจอง —",
    bookSomething: "จองเลย",
    legalAgreePrefix: "การจองถือว่ายอมรับ",
    terms: "ข้อกำหนดการใช้งาน",
    and: "และ",
    privacy: "นโยบายความเป็นส่วนตัว",
    poweredBy: "ให้บริการโดย Velure",
    ownerSignupTitle: "สมัครใช้งานสำหรับร้านค้า",
    ownerSignupSubtitle: "เริ่มรับจองคิวได้ในไม่กี่นาที",
    businessName: "ชื่อร้าน",
    acceptTermsPrefix: "ฉันยอมรับ",
    ownerLoginSubtitle: "ยินดีต้อนรับกลับสู่ Velure",
    errAllFieldsRequired: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
    errAcceptTerms: "กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัว",
    errPasswordShort: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    errEmailTaken: "อีเมลนี้มีบัญชีอยู่แล้ว",
    errEmailTakenLogIn: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทน",
    errEmailPasswordRequired: "กรุณากรอกอีเมลและรหัสผ่าน",
    errInvalidLogin: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    errNameEmailPasswordRequired: "กรุณากรอกชื่อ อีเมล และรหัสผ่าน",
    errPhoneOnFile: "เบอร์โทรนี้ถูกใช้กับอีเมลอื่นอยู่แล้ว",
    errBookingNotFound: "ไม่พบการจองนี้",
    errCannotCancel: "การจองนี้ยกเลิกไม่ได้แล้ว",
    errCannotReschedule: "การจองนี้เลื่อนเวลาไม่ได้แล้ว",
    errAlreadyChanged: "การจองนี้ถูกเปลี่ยนไปแล้ว กรุณารีเฟรชแล้วลองใหม่",
    errTimeTaken: "มีคนจองเวลานี้ไปแล้ว กรุณาเลือกเวลาอื่น",
  },
} satisfies Record<Locale, Record<string, string>>;

export type PublicText = (typeof publicText)["en"];

export function tMinutes(locale: Locale, minutes: number): string {
  return locale === "th" ? `${minutes} นาที` : `${minutes} min`;
}

export function tPolicy(locale: Locale, rescheduleH: number, cancelH: number): string {
  return locale === "th"
    ? `เลื่อนเวลาได้ก่อนนัด ${rescheduleH} ชม. และยกเลิกได้ก่อนนัด ${cancelH} ชม.`
    : `Reschedule up to ${rescheduleH}h and cancel up to ${cancelH}h before your appointment.`;
}

export function tPolicyWithManage(locale: Locale, rescheduleH: number, cancelH: number): string {
  return locale === "th"
    ? `${tPolicy(locale, rescheduleH, cancelH)} ดูลิงก์จัดการการจองได้ในหน้ายืนยัน`
    : `Reschedule up to ${rescheduleH}h and cancel up to ${cancelH}h before your appointment — see your confirmation for the manage link.`;
}

export function tSpotsLeft(locale: Locale, left: number, capacity: number): string {
  return locale === "th" ? `เหลือ ${left} จาก ${capacity} ที่` : `${left} of ${capacity} spots left`;
}

export function tAmountDueLine(locale: Locale, amount: string): string {
  return locale === "th" ? `ยอดที่ต้องชำระ ${amount}` : `Amount due ${amount}`;
}

export function tPayCashOnArrival(locale: Locale, amount: string): string {
  return locale === "th" ? `ชำระเงินสด ${amount} เมื่อมาถึงร้าน` : `Pay ${amount} in cash when you arrive.`;
}

export function tRescheduleCutoff(locale: Locale, hours: number): string {
  return locale === "th"
    ? `ต้องเลื่อนเวลาล่วงหน้าอย่างน้อย ${hours} ชม.`
    : `Reschedules must be made at least ${hours}h in advance.`;
}

export function tCancelCutoff(locale: Locale, hours: number): string {
  return locale === "th"
    ? `ต้องยกเลิกล่วงหน้าอย่างน้อย ${hours} ชม.`
    : `Cancellations must be made at least ${hours}h in advance.`;
}

export function tMovedTo(locale: Locale, time: string): string {
  return locale === "th" ? `✓ ย้ายการจองไปเวลา ${time} แล้ว` : `✓ Booking moved to ${time}`;
}

export function tPaidAmount(locale: Locale, amount: string): string {
  return locale === "th" ? `ชำระแล้ว ${amount}` : `${amount} paid`;
}

export function tCustomerLoginSubtitle(locale: Locale, business: string): string {
  return locale === "th" ? `ดูและจัดการการจองของคุณกับ ${business}` : `See and manage your bookings with ${business}.`;
}

export function tCustomerSignupSubtitle(locale: Locale, business: string): string {
  return locale === "th"
    ? `ดูการจองทั้งหมดกับ ${business} ได้ในที่เดียว และจัดการได้โดยไม่ต้องหาลิงก์ในอีเมลทุกครั้ง`
    : `See all your bookings with ${business} in one place, and manage them without hunting for the email link each time.`;
}

const STATUS_LABEL: Record<Locale, Record<string, string>> = {
  en: {
    TEMPORARY_HOLD: "On hold",
    PAYMENT_PENDING: "Awaiting payment",
    CONFIRMED: "Confirmed",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No-show",
    EXPIRED: "Expired",
    PAYMENT_FAILED: "Payment failed",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partially refunded",
  },
  th: {
    TEMPORARY_HOLD: "จองชั่วคราว",
    PAYMENT_PENDING: "รอชำระเงิน",
    CONFIRMED: "ยืนยันแล้ว",
    COMPLETED: "เสร็จสิ้น",
    CANCELLED: "ยกเลิกแล้ว",
    NO_SHOW: "ไม่มาตามนัด",
    EXPIRED: "หมดเวลา",
    PAYMENT_FAILED: "ชำระเงินไม่สำเร็จ",
    REFUNDED: "คืนเงินแล้ว",
    PARTIALLY_REFUNDED: "คืนเงินบางส่วน",
  },
};

export function tStatus(locale: Locale, status: string): string {
  return STATUS_LABEL[locale][status] ?? status.replace(/_/g, " ");
}

export function tCannotChange(locale: Locale, status: string): string {
  return locale === "th"
    ? `การจองนี้อยู่ในสถานะ "${tStatus(locale, status)}" จึงเปลี่ยนแปลงจากหน้านี้ไม่ได้แล้ว`
    : `This booking is ${tStatus(locale, status).toLowerCase()} and can no longer be changed here.`;
}
