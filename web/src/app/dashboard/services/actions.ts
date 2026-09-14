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

  if (!name || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { ok: false, error: "Name and a valid duration are required." };
  }
  if (!Number.isFinite(priceBaht) || priceBaht < 0) {
    return { ok: false, error: "Price must be a valid amount." };
  }
  if (paymentMode === "deposit" && (!Number.isFinite(depositBaht) || depositBaht <= 0)) {
    return { ok: false, error: "Deposit amount is required for deposit-mode services." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `INSERT INTO services
         (business_id, name, duration_minutes, buffer_minutes, price_amount, payment_mode, deposit_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        owner.businessId,
        name,
        durationMinutes,
        bufferMinutes,
        Math.round(priceBaht * 100),
        paymentMode,
        paymentMode === "deposit" ? Math.round(depositBaht * 100) : null,
      ]
    )
  );

  revalidatePath("/dashboard/services");
  return { ok: true };
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
