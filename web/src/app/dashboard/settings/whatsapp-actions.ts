"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { encryptSecret } from "@/lib/crypto";
import type { ActionResult } from "./actions";

export async function connectWhatsApp(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "Both the phone number ID and access token are required." };
  }

  try {
    await withBusinessContext(owner.businessId, (c) =>
      c.query(
        `UPDATE businesses SET whatsapp_phone_number_id = $1, whatsapp_access_token_encrypted = $2 WHERE id = $3`,
        [phoneNumberId, encryptSecret(accessToken), owner.businessId]
      )
    );
  } catch (err) {
    // whatsapp_phone_number_id is UNIQUE — someone else's business already
    // has this number connected (e.g. re-pasting the wrong id).
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, error: "That phone number is already connected to a different business." };
    }
    throw err;
  }

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function disconnectWhatsApp(_prev: ActionResult | null): Promise<ActionResult> {
  const owner = await requireOwner();
  await withBusinessContext(owner.businessId, (c) =>
    c.query(
      `UPDATE businesses SET whatsapp_phone_number_id = NULL, whatsapp_access_token_encrypted = NULL WHERE id = $1`,
      [owner.businessId]
    )
  );
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
