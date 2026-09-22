"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext, adminPool } from "@/db/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export async function updateBusinessProfile(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  const businessType = String(formData.get("businessType") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();

  if (!name) {
    return { ok: false, error: "Business name is required." };
  }
  if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
    return { ok: false, error: "Logo must be a valid http(s) URL." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `UPDATE businesses
       SET name = $1, business_type = $2, logo_url = $3, description = $4,
           address = $5, contact_phone = $6, contact_email = $7
       WHERE id = $8`,
      [
        name,
        businessType || null,
        logoUrl || null,
        description || null,
        address || null,
        contactPhone || null,
        contactEmail || null,
        owner.businessId,
      ]
    )
  );

  revalidatePath("/dashboard/settings");
  revalidatePath("/book", "layout");
  return { ok: true };
}

export async function updateBusinessHours(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const rows = DAYS.map((dow) => {
    const isClosed = formData.get(`closed_${dow}`) === "on";
    const open = String(formData.get(`open_${dow}`) ?? "");
    const close = String(formData.get(`close_${dow}`) ?? "");
    return { dow, isClosed, open, close };
  });

  for (const row of rows) {
    if (!row.isClosed && (!row.open || !row.close || row.open >= row.close)) {
      return { ok: false, error: "Each open day needs a close time after its open time." };
    }
  }

  await withBusinessContext(owner.businessId, async (c) => {
    for (const row of rows) {
      await c.query(
        `UPDATE business_hours SET is_closed = $1, open_time = $2, close_time = $3
         WHERE business_id = $4 AND day_of_week = $5`,
        [row.isClosed, row.isClosed ? null : row.open, row.isClosed ? null : row.close, owner.businessId, row.dow]
      );
    }
  });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function updatePaymentMethods(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const acceptsCard = formData.get("acceptsCard") === "on";
  const acceptsPromptpay = formData.get("acceptsPromptpay") === "on";
  const acceptsCash = formData.get("acceptsCash") === "on";

  if (!acceptsCard && !acceptsPromptpay && !acceptsCash) {
    return { ok: false, error: "Turn on at least one payment method, or customers won't be able to pay for anything." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `UPDATE businesses SET accepts_card = $1, accepts_promptpay = $2, accepts_cash = $3 WHERE id = $4`,
      [acceptsCard, acceptsPromptpay, acceptsCash, owner.businessId]
    )
  );

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// The columns existed since 010_cancellation_policy.sql (defaults 12h/24h)
// but had no owner-facing way to change them until now — an owner was
// stuck with the defaults short of a raw DB edit. Bounded to a sane range
// so a typo (e.g. 2400 instead of 24) can't silently make cancellation
// effectively impossible or effectively unrestricted.
export async function updateCancellationPolicy(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const rescheduleCutoffHours = Number(formData.get("rescheduleCutoffHours"));
  const cancelCutoffHours = Number(formData.get("cancelCutoffHours"));

  if (!Number.isInteger(rescheduleCutoffHours) || rescheduleCutoffHours < 0 || rescheduleCutoffHours > 720) {
    return { ok: false, error: "Reschedule cutoff must be a whole number of hours, 0 to 720." };
  }
  if (!Number.isInteger(cancelCutoffHours) || cancelCutoffHours < 0 || cancelCutoffHours > 720) {
    return { ok: false, error: "Cancel cutoff must be a whole number of hours, 0 to 720." };
  }

  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `UPDATE businesses SET reschedule_cutoff_hours = $1, cancel_cutoff_hours = $2 WHERE id = $3`,
      [rescheduleCutoffHours, cancelCutoffHours, owner.businessId]
    )
  );

  revalidatePath("/dashboard/settings");
  revalidatePath("/book", "layout");
  return { ok: true };
}

// owners, not businesses — dashboard language is per-owner (see
// 028_owner_locale.sql), so this writes there directly via adminPool, the
// same way every other owners-table touch in this codebase does (that
// table has never gone through withBusinessContext; it's how you get an
// owner's identity in the first place, not data scoped by one).
export async function updateLocale(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const locale = String(formData.get("locale") ?? "");

  if (locale !== "en" && locale !== "th") {
    return { ok: false, error: "Invalid language." };
  }

  await adminPool.query(`UPDATE owners SET locale = $1 WHERE id = $2`, [locale, owner.ownerId]);

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
