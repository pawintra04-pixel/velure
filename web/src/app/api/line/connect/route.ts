import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminPool } from "@/db/client";

// LINE Login (a separate channel from the Messaging API channel that
// actually sends notifications, though both belong to the same LINE
// Official Account) is the only way to get a customer's LINE user id —
// it isn't derivable from their phone/email the way nothing about LINE's
// identity system is tied to those. Reached from a public booking-
// management page (an unauthenticated customer, identified only by the
// unguessable bookingId in the link they already have), so bookingId
// doubles as this flow's own state/authorization rather than needing a
// session.
export async function GET(req: Request) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "line_login_not_configured" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "missing_booking_id" }, { status: 400 });
  }

  const { rows: [booking] } = await adminPool.query(`SELECT id FROM bookings WHERE id = $1`, [bookingId]);
  if (!booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  // state carries both the booking id (to know which customer to attach
  // the LINE user id to on return) and a random nonce (real CSRF
  // protection) — LINE echoes state back verbatim on callback.
  const state = `${bookingId}.${randomUUID()}`;

  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", channelId);
  authorizeUrl.searchParams.set("redirect_uri", `${baseUrl}/api/line/callback`);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "openid");

  const response = NextResponse.redirect(authorizeUrl.toString());
  // Short-lived, httpOnly: the callback checks this matches the state LINE
  // sends back, closing the CSRF window a bare state-in-URL would leave open.
  response.cookies.set("line_login_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
