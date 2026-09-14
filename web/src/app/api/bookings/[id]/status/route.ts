import { NextResponse } from "next/server";
import { adminPool } from "@/db/client";

// Public, polled from the payment page. Booking ids are unguessable UUIDs
// and this leaks only a status string (no PII), so a plain adminPool lookup
// by primary key is an acceptable exception to "always scope by business" —
// there is no listing/enumeration surface here, just one row by id.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rows: [booking] } = await adminPool.query(
    `SELECT status FROM bookings WHERE id = $1`,
    [id]
  );
  if (!booking) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ status: booking.status });
}
