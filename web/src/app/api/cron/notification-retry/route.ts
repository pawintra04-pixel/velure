import { NextResponse } from "next/server";
import { retryFailedNotifications } from "@/lib/notifications";

/**
 * Vercel Cron target (see vercel.json) — sweeps notification_log for
 * channels still marked 'failed' and retries them, bounded by
 * MAX_RETRY_COUNT in notifications.ts so a permanently broken channel
 * (e.g. WhatsApp before a Template is approved) doesn't retry forever.
 * Vercel signs cron requests with this bearer token automatically; this
 * guards the route from being triggered by anyone else who finds the URL.
 *
 * Runs once daily (03:00 Bangkok time), not every 15 minutes as first
 * designed — Vercel's Hobby plan rejects any cron expression that would
 * fire more than once a day (deploy-time error, discovered the hard way).
 * Fine for this job's actual stakes: a failed notification's booking is
 * already committed either way, so a slower retry only delays a customer
 * hearing about it again, never risks anything.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await retryFailedNotifications();
  return NextResponse.json({ ok: true, ...result });
}
