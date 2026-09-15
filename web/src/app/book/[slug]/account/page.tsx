import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { requireCustomer } from "@/lib/customer-auth";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { BookingHeader } from "@/components/booking/BookingHeader";
import { customerLogOut } from "../customer-auth-actions";

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-[#0ca30c]/10 text-[#0ca30c]",
  PAYMENT_PENDING: "bg-[#fab219]/20 text-[#8a5a00]",
  TEMPORARY_HOLD: "bg-ink/5 text-ink-muted",
  COMPLETED: "bg-ink/5 text-ink-secondary",
  CANCELLED: "bg-ink/5 text-ink-muted line-through",
  NO_SHOW: "bg-[#d03b3b]/10 text-[#d03b3b]",
  PAYMENT_FAILED: "bg-[#d03b3b]/10 text-[#d03b3b]",
  EXPIRED: "bg-ink/5 text-ink-muted",
  REFUNDED: "bg-ink/5 text-ink-muted line-through",
  PARTIALLY_REFUNDED: "bg-[#fab219]/20 text-[#8a5a00]",
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function CustomerAccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const customer = await requireCustomer(slug, business.id);

  // RLS-scoped even though the customer id itself already came from a
  // verified session — defense in depth, same as every other business-
  // scoped query in this app.
  const bookings = await withBusinessContext(business.id, async (c) => {
    const { rows } = await c.query(
      `SELECT b.id, b.status, b.amount, b.start_time, s.name AS service_name, st.name AS staff_name
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN staff st ON st.id = b.staff_id
       WHERE b.customer_id = $1
       ORDER BY b.start_time DESC`,
      [customer.customerId]
    );
    return rows;
  });

  return (
    <>
      <BookingHeader businessName={business.name} slug={slug} businessId={business.id} logoUrl={business.logo_url} />
      <div className="mx-auto max-w-2xl px-6 py-12 lg:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My bookings</h1>
            <p className="mt-1 text-sm text-ink-secondary">{customer.name} · {customer.email}</p>
          </div>
          <form action={customerLogOut}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
            >
              Log out
            </button>
          </form>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {bookings.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-ink-muted">
              No bookings yet —{" "}
              <Link href={`/book/${slug}`} className="text-accent underline">
                book something
              </Link>
              .
            </div>
          )}
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/book/manage/${b.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5 hover:border-accent"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{b.service_name}</div>
                <div className="truncate text-sm text-ink-muted">
                  {b.staff_name} · {formatTime(b.start_time)} · {formatBaht(b.amount)}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_STYLE[b.status] ?? "bg-ink/5 text-ink-muted"
                }`}
              >
                {b.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
