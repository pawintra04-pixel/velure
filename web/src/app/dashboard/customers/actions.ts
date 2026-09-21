"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function updateCustomerNotes(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const customerId = String(formData.get("customerId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE customers SET notes = $1 WHERE id = $2`, [notes || null, customerId])
  );

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { ok: true, message: "Notes saved" };
}
