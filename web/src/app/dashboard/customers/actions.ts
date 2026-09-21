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

// One tag per line in the textarea — deliberately not a comma-split (tags
// like "prefers afternoon, no evenings" would otherwise get mangled into
// two tags). Trimmed and empties dropped; duplicates collapse naturally
// since tags are just an unordered set an owner is scanning, not a
// counted/ordered list.
export async function updateCustomerTags(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();
  const customerId = String(formData.get("customerId") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = [...new Set(tagsRaw.split("\n").map((t) => t.trim()).filter(Boolean))];

  await withBusinessContext(owner.businessId, (c) =>
    c.query(`UPDATE customers SET tags = $1 WHERE id = $2`, [tags, customerId])
  );

  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath("/dashboard/customers");
  return { ok: true, message: "Tags saved" };
}
