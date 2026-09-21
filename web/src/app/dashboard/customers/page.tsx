import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { searchCustomers } from "@/lib/customers-data";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const owner = await requireOwner();
  const { q } = await searchParams;
  const customers = await searchCustomers(owner.businessId, q?.trim() || null);

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader
          title="Customers"
          description="Everyone who has booked with you."
          actions={
            <form action="/dashboard/customers">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search by name, phone, or email…"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm sm:w-72"
              />
            </form>
          }
        />
      </div>

      <div className="mt-6">
        {customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {q ? "No customers match that search." : "No customers yet — they'll show up here after a booking."}
          </div>
        ) : (
          <>
            <div className="mb-3 text-[13px] text-ink-muted">
              {customers.length} customer{customers.length === 1 ? "" : "s"}
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border">
              {customers.map((cust) => (
                <Link
                  key={cust.id}
                  href={`/dashboard/customers/${cust.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-page"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] text-ink">{cust.name}</div>
                    <div className="truncate text-[13px] text-ink-muted">
                      {[cust.phone, cust.email].filter(Boolean).join(" · ") || "No contact info on file"}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-[13px] text-ink-muted">
                    {cust.bookingCount} booking{cust.bookingCount === 1 ? "" : "s"}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
