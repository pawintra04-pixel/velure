"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { cancelWaitlistEntry } from "@/lib/waitlist";
import type { ConfirmActionResult } from "@/components/ConfirmSubmitButton";

export async function removeWaitlistEntry(
  _prev: ConfirmActionResult | null,
  formData: FormData
): Promise<ConfirmActionResult> {
  const owner = await requireOwner();
  const entryId = String(formData.get("entryId") ?? "");

  await withBusinessContext(owner.businessId, (c) => cancelWaitlistEntry(c, entryId));

  revalidatePath("/dashboard/waitlist");
  return { ok: true, message: "Removed" };
}
