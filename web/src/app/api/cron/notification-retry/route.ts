import { NextResponse } from "next/server";
import { retryFailedNotifications, remindUpcomingBookings } from "@/lib/notifications";

/**
 * Vercel Cron target (see vercel.json) — the one daily job doing two
 * things, not two separate cron entries: Vercel's Hobby plan caps both how
 * often a cron can fire (daily max) AND how many cron jobs a project can
 * have, discovered the hard way on the frequency limit already (see the
 * retry-only version of this comment in git history). Sharing one route
 * costs nothing — both are cheap DB sweeps.
 *
 * Runs once daily at 09:00 Bangkok time (moved from the original
 * retry-only job's 03:00 once reminders — customer-facing, unlike a
 * silent retry — joined this route; nobody should get a "see you
 * tomorrow" message at 3am).
 *
 * Vercel signs cron requests with this bearer token automatically; this
 * guards the route from being triggered by anyone else who finds the URL.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  // An unset secret must fail closed — otherwise the literal header
  // "Bearer undefined" would match and anyone could trigger the job.
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const retryResult = await retryFailedNotifications();
  const reminderResult = await remindUpcomingBookings();
  return NextResponse.json({
    ok: true,
    retried: retryResult.attempted,
    reminded: reminderResult.attempted,
  });
}
