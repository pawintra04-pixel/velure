import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminPool } from "@/db/client";

export async function GET(req: Request) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  if (!channelId || !channelSecret) {
    return NextResponse.json({ error: "line_login_not_configured" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const bookingId = state?.split(".")[0];

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("line_login_state")?.value;
  cookieStore.delete("line_login_state");

  if (!code || !state || !bookingId || state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/book/manage/${bookingId ?? ""}?line=error`);
  }

  try {
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${baseUrl}/api/line/callback`,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${await tokenRes.text()}`);
    const { id_token: idToken } = await tokenRes.json();

    // LINE's own verify endpoint decodes *and* validates the id_token
    // (signature, audience, expiry) server-side — no local JWT library or
    // JWKS handling needed, and no risk of trusting an unverified claim.
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
    if (!verifyRes.ok) throw new Error(`id_token verify failed: ${await verifyRes.text()}`);
    const { sub: lineUserId } = await verifyRes.json();
    if (!lineUserId) throw new Error("no sub claim in verified id_token");

    const { rows: [booking] } = await adminPool.query(
      `SELECT customer_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (!booking?.customer_id) throw new Error("booking has no customer yet");

    await adminPool.query(`UPDATE customers SET line_user_id = $1 WHERE id = $2`, [
      lineUserId,
      booking.customer_id,
    ]);
  } catch (err) {
    console.error("LINE connect failed", err);
    return NextResponse.redirect(`${baseUrl}/book/manage/${bookingId}?line=error`);
  }

  return NextResponse.redirect(`${baseUrl}/book/manage/${bookingId}?line=connected`);
}
