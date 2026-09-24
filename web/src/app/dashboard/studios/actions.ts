"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function createResource(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { ok: false, error: "Room name is required." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`INSERT INTO resources (business_id, name) VALUES ($1, $2)`, [owner.businessId, name])
  );

  revalidatePath("/dashboard/studios");
  return { ok: true };
}

// An upcoming class/booking still in the room is an expected, recoverable
// block on delete — not a crash — so it's reported via the same typed
// result every other action here uses, instead of a thrown Error that
// would escape to the dashboard's error boundary.
export async function deleteResource(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const resourceId = String(formData.get("resourceId") ?? "");

  const removed = await withBusinessContext(owner.businessId, async (c) => {
    // Same-table FK (resources <- class_sessions/bookings.resource_id) would
    // otherwise surface as a raw constraint violation — check first so the
    // owner gets a plain explanation instead of a crash.
    const { rows: [conflict] } = await c.query(
      `SELECT 1 FROM class_sessions WHERE resource_id = $1 AND start_time >= now()
       UNION ALL
       SELECT 1 FROM bookings WHERE resource_id = $1 AND start_time >= now()
         AND status IN ('TEMPORARY_HOLD', 'PAYMENT_PENDING', 'CONFIRMED')
       LIMIT 1`,
      [resourceId]
    );
    if (conflict) return false;
    await c.query(`DELETE FROM resources WHERE id = $1`, [resourceId]);
    return true;
  });

  if (!removed) {
    return {
      ok: false,
      error: "Can't remove a room with upcoming classes or bookings in it. Move or cancel those first.",
    };
  }

  revalidatePath("/dashboard/studios");
  return { ok: true };
}

// A temporary close (renovation, deep clean, etc.) — keeps the room and its
// full schedule history, just stops it from being offered for NEW class
// sessions going forward (see CreateSessionForm's resource list, which
// only queries is_active rooms). Existing sessions/bookings already in this
// room are untouched either way. Goes through ConfirmSubmitButton like
// every other consequential dashboard action.
export async function toggleResourceActive(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const resourceId = String(formData.get("resourceId") ?? "");
  const nextActive = formData.get("nextActive") === "true";

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE resources SET is_active = $1 WHERE id = $2`, [nextActive, resourceId])
  );

  revalidatePath("/dashboard/studios");
  revalidatePath("/dashboard/classes");
  return { ok: true };
}
