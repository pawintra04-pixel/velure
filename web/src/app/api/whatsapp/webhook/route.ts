import { NextResponse } from "next/server";
import { verifyWebhookSignature, handleIncomingMessage } from "@/lib/whatsapp";

/**
 * Meta's one-time webhook verification handshake — required to even save
 * this URL in the Meta App dashboard. It echoes back `hub.challenge` iff
 * `hub.verify_token` matches a token you chose yourself (not secret,
 * just has to match what you typed into Meta's console).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

/**
 * Real inbound events land here. Reads the body as raw text first because
 * signature verification hashes the exact bytes Meta sent — re-serializing
 * a parsed JSON object would very likely produce different bytes and
 * always fail the check.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // Meta's webhook payload shape: entry[].changes[].value.{metadata,messages}
  // — see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const message of value?.messages ?? []) {
        if (!phoneNumberId || !message.from) continue;
        const buttonId: string | null = message.interactive?.button_reply?.id ?? null;
        const text: string | null = message.text?.body ?? null;
        await handleIncomingMessage({ phoneNumberId, from: message.from, buttonId, text });
      }
    }
  }

  // Meta requires a fast 200 regardless of what happened inside — it
  // retries (and eventually disables the webhook) on non-200s, and any
  // per-message failure is already logged inside handleIncomingMessage
  // rather than surfaced as a delivery failure to Meta.
  return NextResponse.json({ ok: true });
}
