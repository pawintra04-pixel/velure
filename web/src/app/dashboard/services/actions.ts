"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

// businessId always comes from the session (requireOwner), never from
// formData — a client-supplied business id here would let one owner edit
// another business's services just by editing the request.
export async function addService(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const bufferMinutes = Number(formData.get("bufferMinutes") ?? 0);
  const priceBaht = Number(formData.get("priceBaht"));
  const paymentMode = String(formData.get("paymentMode") ?? "full");
  const depositBaht = Number(formData.get("depositBaht") ?? 0);
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  if (!name || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: "Name and a valid duration are required." };
  }
  if (!Number.isFinite(priceBaht) || priceBaht < 0) {
    return { ok: false, error: "Price must be a valid amount." };
  }
  if (paymentMode === "deposit" && (!Number.isFinite(depositBaht) || depositBaht <= 0)) {
    return { ok: false, error: "Deposit amount is required for deposit-mode services." };
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 2)) {
    return { ok: false, error: "Capacity must be a whole number of 2 or more (leave blank for a regular 1:1 service)." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `INSERT INTO services
         (business_id, name, duration_minutes, buffer_minutes, price_amount, payment_mode, deposit_amount, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        owner.businessId,
        name,
        durationMinutes,
        bufferMinutes,
        Math.round(priceBaht * 100),
        paymentMode,
        paymentMode === "deposit" ? Math.round(depositBaht * 100) : null,
        capacity,
      ]
    )
  );

  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function updateServiceDetails(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  if (!serviceId) return { ok: false, error: "Missing service." };
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
    return { ok: false, error: "Image must be a valid http(s) URL." };
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 2)) {
    return { ok: false, error: "Capacity must be a whole number of 2 or more (leave blank for a regular 1:1 service)." };
  }

  // Each class_session snapshots its own capacity at creation time (see
  // classes/actions.ts createOneSession) rather than referencing this
  // column live, so changing it here only takes effect for sessions
  // scheduled after the change — already-scheduled ones keep whatever
  // capacity they were created with, same as changing a service's price
  // never touches bookings already made at the old price.
  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `UPDATE services SET description = $1, image_url = $2, capacity = $3 WHERE id = $4`,
      [description || null, imageUrl || null, capacity, serviceId]
    )
  );

  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function addCustomField(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const importance = String(formData.get("importance") ?? "optional");

  if (!serviceId || !label) {
    return { ok: false, error: "A label is required." };
  }
  if (!["optional", "important", "required"].includes(importance)) {
    return { ok: false, error: "Invalid importance." };
  }

  await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [{ next_order }] } = await c.query<{ next_order: number }>(
      `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM service_custom_fields WHERE service_id = $1`,
      [serviceId]
    );
    await c.query(
      `INSERT INTO service_custom_fields (business_id, service_id, label, importance, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [owner.businessId, serviceId, label, importance, next_order]
    );
  });

  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function deleteCustomField(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const fieldId = String(formData.get("fieldId") ?? "");

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`DELETE FROM service_custom_fields WHERE id = $1`, [fieldId])
  );

  revalidatePath("/dashboard/services");
}

export async function addPackage(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const serviceId = String(formData.get("serviceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sessionCount = Number(formData.get("sessionCount"));
  const priceBaht = Number(formData.get("priceBaht"));
  const validityDaysRaw = String(formData.get("validityDays") ?? "").trim();
  const validityDays = validityDaysRaw ? Number(validityDaysRaw) : null;

  if (!serviceId || !name) {
    return { ok: false, error: "A name and service are required." };
  }
  if (!Number.isInteger(sessionCount) || sessionCount < 2) {
    return { ok: false, error: "Session count must be a whole number of 2 or more." };
  }
  if (!Number.isFinite(priceBaht) || priceBaht < 0) {
    return { ok: false, error: "Price must be a valid amount." };
  }
  if (validityDays !== null && (!Number.isInteger(validityDays) || validityDays <= 0)) {
    return { ok: false, error: "Validity must be a whole number of days (leave blank for no expiry)." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `INSERT INTO packages (business_id, service_id, name, session_count, price_amount, validity_days)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [owner.businessId, serviceId, name, sessionCount, Math.round(priceBaht * 100), validityDays]
    )
  );

  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function deactivatePackage(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const packageId = String(formData.get("packageId") ?? "");

  // Deactivate, never delete — a package that's already been sold must
  // keep existing forever for package_purchases' FK and for reports to
  // keep making sense; is_active only controls whether it can be sold
  // again, the same relationship resources.is_active has to new bookings.
  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE packages SET is_active = false WHERE id = $1`, [packageId])
  );

  revalidatePath("/dashboard/services");
}

export async function deleteService(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const serviceId = String(formData.get("serviceId") ?? "");

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      await c.query(`DELETE FROM staff_services WHERE service_id = $1`, [serviceId]);
      await c.query(`DELETE FROM services WHERE id = $1`, [serviceId]);
    });
  } catch (err) {
    // bookings.service_id has no ON DELETE CASCADE on purpose — a service
    // with booking history shouldn't silently vanish out from under it.
    if ((err as { code?: string }).code === "23503") {
      throw new Error(
        "Can't delete a service that has existing bookings. Bookings must be cancelled first."
      );
    }
    throw err;
  }

  revalidatePath("/dashboard/services");
}
