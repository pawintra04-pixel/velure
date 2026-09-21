import { createHmac, timingSafeEqual } from "node:crypto";
import { adminPool } from "@/db/client";
import { decryptSecret } from "@/lib/crypto";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

// Fixed, deterministic menu — no AI/NLU anywhere in this file. The owner
// explicitly asked for buttons only after weighing an AI-intent-detection
// design: free text gets this same menu re-sent, never interpreted.
const MENU_BUTTONS = [
  { id: "book", title: "Book a slot" },
  { id: "manage", title: "My booking" },
  { id: "human", title: "Talk to staff" },
] as const;

type BusinessWhatsApp = { businessId: string; slug: string; name: string; accessToken: string };

// Deterministic substring matching, NOT AI/NLU — every keyword here maps
// to exactly one of the same three button ids, so a keyword hit is
// handled by the identical code path a button tap would take. No model,
// no confidence score, no ambiguity: a message either contains one of
// these literal substrings or it doesn't. English and Thai only for now
// (this pilot's actual customer base per the owner is mostly foreign
// tourists, but a Thai-speaking customer or staff member testing this
// should still get a sensible match).
// Order matters: checked top to bottom, first match wins. "manage" goes
// first because its words (cancel, reschedule...) are the more specific
// signal — a message like "cancel my appointment" also contains "book"
// category words ("appointment"), and should route to managing an
// existing booking, not starting a new one. Found by testing, not
// guessed: an earlier book-first ordering mis-routed exactly this case.
const KEYWORD_MAP: { id: (typeof MENU_BUTTONS)[number]["id"]; words: string[] }[] = [
  { id: "manage", words: ["cancel", "reschedule", "change", "my booking", "ยกเลิก", "เลื่อน", "แก้ไข"] },
  { id: "book", words: ["book", "booking", "reserve", "appointment", "จอง", "นัด"] },
  { id: "human", words: ["human", "staff", "person", "agent", "คุยกับคน", "พนักงาน"] },
];

function matchKeyword(text: string): (typeof MENU_BUTTONS)[number]["id"] | null {
  const lower = text.toLowerCase();
  for (const entry of KEYWORD_MAP) {
    if (entry.words.some((w) => lower.includes(w))) return entry.id;
  }
  return null;
}

// How long to wait before re-sending the full interactive menu to the same
// customer after they've already gotten it once — repeat free text that
// doesn't match a keyword gets a short one-line nudge instead within this
// window, so the bot doesn't look like it's spamming the identical card.
const MENU_RESEND_COOLDOWN_MS = 30 * 60 * 1000;

async function shouldSendFullMenu(businessId: string, waId: string): Promise<boolean> {
  const { rows: [row] } = await adminPool.query<{ last_menu_sent_at: string }>(
    `SELECT last_menu_sent_at FROM whatsapp_conversations WHERE business_id = $1 AND wa_id = $2`,
    [businessId, waId]
  );
  if (!row) return true;
  return Date.now() - new Date(row.last_menu_sent_at).getTime() > MENU_RESEND_COOLDOWN_MS;
}

async function recordMenuSent(businessId: string, waId: string): Promise<void> {
  await adminPool.query(
    `INSERT INTO whatsapp_conversations (business_id, wa_id, last_menu_sent_at)
     VALUES ($1, $2, now())
     ON CONFLICT (business_id, wa_id) DO UPDATE SET last_menu_sent_at = now()`,
    [businessId, waId]
  );
}

/** Looks up which business owns this WhatsApp number — the webhook's entry point, same role getBusinessBySlug plays for the public booking page. */
async function getBusinessByPhoneNumberId(phoneNumberId: string): Promise<BusinessWhatsApp | null> {
  const { rows: [row] } = await adminPool.query(
    `SELECT id, slug, name, whatsapp_access_token_encrypted
     FROM businesses WHERE whatsapp_phone_number_id = $1`,
    [phoneNumberId]
  );
  if (!row || !row.whatsapp_access_token_encrypted) return null;
  return {
    businessId: row.id,
    slug: row.slug,
    name: row.name,
    accessToken: decryptSecret(row.whatsapp_access_token_encrypted),
  };
}

/**
 * Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body,
 * keyed by the app secret) — the only thing standing between this webhook
 * and anyone on the internet POSTing fake "customer wants to book" events.
 * Same category of check as the Stripe webhook's signature verification,
 * except Meta signs with one app-level secret (WHATSAPP_APP_SECRET) shared
 * across every connected business, not a per-business one — the signature
 * only proves "this came from Meta", not which business it's for; that
 * still comes from phone_number_id in the payload.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function callGraphApi(accessToken: string, phoneNumberId: string, body: unknown): Promise<void> {
  const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[whatsapp] send failed (${res.status})`, await res.text());
  }
}

async function sendMenu(business: BusinessWhatsApp, phoneNumberId: string, to: string, bodyText: string): Promise<void> {
  await callGraphApi(business.accessToken, phoneNumberId, {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: MENU_BUTTONS.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })),
      },
    },
  });
}

async function sendText(business: BusinessWhatsApp, phoneNumberId: string, to: string, text: string): Promise<void> {
  await callGraphApi(business.accessToken, phoneNumberId, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

// wa_id arrives as a bare international number (e.g. "66812345678", no
// "+"), customers.phone is whatever a customer typed on the web booking
// form (usually a local "0812345678"). Matching on the last 9 digits is a
// deliberately loose heuristic — good enough to find "my booking" without
// building a full phone-normalization library for a first cut; a business
// with a customer whose stored number collides on the last 9 digits with
// someone else's (extremely unlikely — that's the whole subscriber number)
// would be the only failure mode.
function last9Digits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-9);
}

async function findRecentBookingByPhone(businessId: string, waId: string): Promise<string | null> {
  const { rows } = await adminPool.query<{ id: string; phone: string | null }>(
    `SELECT b.id, cu.phone
     FROM bookings b
     JOIN customers cu ON cu.id = b.customer_id
     WHERE b.business_id = $1 AND cu.phone IS NOT NULL
       AND b.status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
     ORDER BY b.start_time DESC
     LIMIT 50`,
    [businessId]
  );
  const target = last9Digits(waId);
  const match = rows.find((r) => r.phone && last9Digits(r.phone) === target);
  return match?.id ?? null;
}

/**
 * Handles one inbound WhatsApp message — the webhook's whole job after
 * signature verification. Deliberately a flat if/else over a fixed set of
 * button ids, never free-text parsing: see MENU_BUTTONS' comment.
 */
export async function handleIncomingMessage(params: {
  phoneNumberId: string;
  from: string;
  buttonId: string | null; // set only when the customer tapped a button
  text: string | null; // the free-text body, if this wasn't a button tap
}): Promise<void> {
  const business = await getBusinessByPhoneNumberId(params.phoneNumberId);
  if (!business) {
    console.log(`[whatsapp] no business connected for phone_number_id ${params.phoneNumberId}`);
    return;
  }

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  // A keyword match is handled exactly like a button tap — see
  // KEYWORD_MAP's comment for why this is still deterministic, not AI.
  const intent = params.buttonId ?? (params.text ? matchKeyword(params.text) : null);

  if (intent === "book") {
    await sendText(
      business,
      params.phoneNumberId,
      params.from,
      `Book a slot at ${business.name} here:\n${baseUrl}/book/${business.slug}`
    );
    return;
  }

  if (intent === "manage") {
    const bookingId = await findRecentBookingByPhone(business.businessId, params.from);
    if (bookingId) {
      await sendText(
        business,
        params.phoneNumberId,
        params.from,
        `Manage your booking here:\n${baseUrl}/book/manage/${bookingId}`
      );
    } else {
      await sendText(
        business,
        params.phoneNumberId,
        params.from,
        `We couldn't find a booking under this number. Tap "Book a slot" below to make one.`
      );
      await sendMenu(business, params.phoneNumberId, params.from, "What would you like to do?");
    }
    return;
  }

  if (intent === "human") {
    await sendText(
      business,
      params.phoneNumberId,
      params.from,
      `We've noted you'd like to speak with staff — someone from ${business.name} will reply here.`
    );
    return;
  }

  // First contact, or free text that matched no keyword. Re-sending the
  // full interactive menu on every single one of these reads as robotic
  // spam if the customer sends several messages in a row — so only the
  // first one in a while gets the full card; the rest get a short nudge
  // pointing back at it instead of a repeated identical message.
  if (await shouldSendFullMenu(business.businessId, params.from)) {
    await sendMenu(business, params.phoneNumberId, params.from, `Hi! How can ${business.name} help you today?`);
    await recordMenuSent(business.businessId, params.from);
  } else {
    await sendText(
      business,
      params.phoneNumberId,
      params.from,
      `Tap a button above, or type "book" to get your booking link.`
    );
  }
}
