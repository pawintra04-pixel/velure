"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addStaff(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const owner = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  const serviceIds = formData.getAll("serviceIds").map(String);

  if (!name) {
    return { ok: false, error: "Name is required." };
  }

  await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [staff] } = await c.query(
      `INSERT INTO staff (business_id, name) VALUES ($1, $2) RETURNING id`,
      [owner.businessId, name]
    );
    for (const serviceId of serviceIds) {
      await c.query(
        `INSERT INTO staff_services (business_id, staff_id, service_id) VALUES ($1, $2, $3)`,
        [owner.businessId, staff.id, serviceId]
      );
    }
  });

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function deleteStaff(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const staffId = String(formData.get("staffId") ?? "");

  try {
    await withBusinessContext(owner.businessId, async (c) => {
      await c.query(`DELETE FROM staff_services WHERE staff_id = $1`, [staffId]);
      await c.query(`DELETE FROM staff WHERE id = $1`, [staffId]);
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23503") {
      throw new Error(
        "Can't delete a staff member who has existing bookings. Cancel or reassign those bookings first."
      );
    }
    throw err;
  }

  revalidatePath("/dashboard/staff");
}
