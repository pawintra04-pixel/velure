"use server";

import { adminPool, withBusinessContext } from "@/db/client";
import { getAvailableSlots, type Slot } from "@/lib/availability";
import { releaseClassSeat } from "@/lib/classes";
import { restorePackageSession } from "@/lib/packages";
import { notify, clearReminderRecord } from "@/lib/notifications";
import { isSlotConflictError } from "@/lib/staff-availability";
import { checkWaitlistForCancelledSlot } from "@/lib/waitlist";
import { getVisitorLocale } from "@/lib/visitor-locale";
import { publicText } from "@/lib/i18n-public";

type PolicyCheck = {
  businessId: string;
  serviceId: string;
  status: string;
  startTime: string;
  rescheduleCutoffHours: number;
  cancelCutoffHours: number;
  classSessionId: string | null;
  packagePurchaseId: string | null;
};

/**
 * bookingId is the only input the caller (an unauthenticated customer,
 * reached via an unguessable link) provides — everything else, including
 * which business this belongs to, is looked up server-side. Never trust a
 * businessId from this kind of client.
 */
async function loadPolicyCheck(bookingId: string): Promise<PolicyCheck | null> {
  const { rows: [row] } = await adminPool.query(
    `SELECT b.business_id, b.service_id, b.status, b.start_time, b.class_session_id, b.package_purchase_id,
            biz.reschedule_cutoff_hours, biz.cancel_cutoff_hours
     FROM bookings b
     JOIN businesses biz ON biz.id = b.business_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (!row) return null;
  return {
    businessId: row.business_id,
    serviceId: row.service_id,
    status: row.status,
    startTime: row.start_time,
    rescheduleCutoffHours: row.reschedule_cutoff_hours,
    cancelCutoffHours: row.cancel_cutoff_hours,
    classSessionId: row.class_session_id,
    packagePurchaseId: row.package_purchase_id,
  };
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000);
}

export async function fetchRescheduleSlots(bookingId: string, dateISO: string): Promise<Slot[]> {
  const check = await loadPolicyCheck(bookingId);
  if (!check) return [];
  return getAvailableSlots(check.businessId, check.serviceId, dateISO, bookingId);
}

export type ManageActionResult = { ok: true } | { ok: false; error: string };

export async function cancelBooking(bookingId: string): Promise<ManageActionResult> {
  const t = publicText[await getVisitorLocale()];
  const check = await loadPolicyCheck(bookingId);
  if (!check) return { ok: false, error: t.errBookingNotFound };
  if (check.status !== "CONFIRMED") {
    return { ok: false, error: t.errCannotCancel };
  }
  // Re-check the cutoff server-side even though the page only shows the
  // button when it's allowed — the page could be stale by the time it's
  // clicked, and this is an unauthenticated action reachable by anyone with
  // the link.
  if (hoursUntil(check.startTime) < check.cancelCutoffHours) {
    return {
      ok: false,
      error: `Cancellations must be made at least ${check.cancelCutoffHours} hours in advance.`,
    };
  }

  const cancelled = await withBusinessContext(check.businessId, async (c) => {
    const result = await c.query(
      `UPDATE bookings SET status = 'CANCELLED' WHERE id = $1 AND status = 'CONFIRMED'`,
      [bookingId]
    );
    // Free the seat / restore the package session back up — neither
    // class_sessions.seats_booked nor a package's balance ever moves
    // through anything but an explicit call like this, never a live count.
    if (result.rowCount) {
      if (check.classSessionId) await releaseClassSeat(c, check.classSessionId);
      if (check.packagePurchaseId) await restorePackageSession(c, check.packagePurchaseId);
    }
    return result.rowCount ?? 0;
  });
  // Someone else (the owner, or a concurrent request) could have changed
  // this booking's status between loadPolicyCheck and this UPDATE — never
  // report success unless the write actually affected a row.
  if (cancelled === 0) {
    return { ok: false, error: t.errAlreadyChanged };
  }
  // Fire-and-forget, after the cancellation has already committed — an
  // email failure must never undo or block a real cancellation.
  void notify("booking_cancelled", bookingId);
  void checkWaitlistForCancelledSlot(check.businessId, check.serviceId, check.startTime);
  return { ok: true };
}

export async function rescheduleBooking(
  bookingId: string,
  newStartTime: string,
  newEndTime: string
): Promise<ManageActionResult> {
  const t = publicText[await getVisitorLocale()];
  const check = await loadPolicyCheck(bookingId);
  if (!check) return { ok: false, error: t.errBookingNotFound };
  if (check.status !== "CONFIRMED") {
    return { ok: false, error: t.errCannotReschedule };
  }
  // A class booking's time belongs to its session, not to this individual
  // attendee — moving it would mean moving everyone else registered too.
  // Cancel and re-register for a different session instead.
  if (check.classSessionId) {
    return { ok: false, error: t.classNoReschedule };
  }
  if (hoursUntil(check.startTime) < check.rescheduleCutoffHours) {
    return {
      ok: false,
      error: `Reschedules must be made at least ${check.rescheduleCutoffHours} hours in advance.`,
    };
  }

  try {
    const result = await withBusinessContext(check.businessId, (c) =>
      c.query(
        `UPDATE bookings SET start_time = $1, end_time = $2 WHERE id = $3 AND status = 'CONFIRMED'`,
        [newStartTime, newEndTime, bookingId]
      )
    );
    // Same "don't fake success" guard as cancelBooking — a concurrent
    // change (owner cancels, payment fails, etc.) between the read above
    // and this UPDATE means 0 rows affected even though no error was
    // thrown.
    if (!result.rowCount) {
      return { ok: false, error: t.errAlreadyChanged };
    }
    // Clear any prior reminder record before notifying — otherwise a
    // booking reminded once for its old time would never be reminded
    // again for the new one (notification_log would already show 'sent'
    // for this booking's reminder, regardless of which time it was about).
    void clearReminderRecord(bookingId).then(() => notify("booking_rescheduled", bookingId));
    return { ok: true };
  } catch (err) {
    // The overlap EXCLUDE constraint applies to UPDATEs too, not just
    // INSERTs — a slot picked a moment ago can still lose a race here.
    if (isSlotConflictError(err)) {
      return { ok: false, error: t.errTimeTaken };
    }
    console.error("rescheduleBooking failed", err);
    return { ok: false, error: t.genericError };
  }
}
