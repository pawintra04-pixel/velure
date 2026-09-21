import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getCustomer, getBookingsForCustomer } from "@/lib/customers-data";
import { BookingRow, BookingList } from "@/app/dashboard/bookings/BookingRow";
import { NotesForm } from "./NotesForm";
import { TagsForm } from "./TagsForm";
import { formatBaht } from "@/lib/money";
import { PageShell, Surface } from "@/components/dashboard/PageShell";

function formatLastVisit(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", dateStyle: "medium" }).format(
    new Date(iso)
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const owner = await requireOwner();
  const { customerId } = await params;

  const customer = await getCustomer(owner.businessId, customerId);
  if (!customer) notFound();

  const bookings = await getBookingsForCustomer(owner.businessId, customerId);
  const now = new Date().getTime();
  const upcoming = bookings
    .filter((b) => new Date(b.startTime).getTime() > now && ["TEMPORARY_HOLD", "PAYMENT_PENDING", "CONFIRMED"].includes(b.status))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const past = bookings
    .filter((b) => !upcoming.includes(b))
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <PageShell width="standard">
      <Link href="/dashboard/customers" className="text-sm text-ink-secondary hover:text-ink">
        ← Customers
      </Link>

      <div className="mt-3 flex flex-col gap-1 border-b border-border pb-5">
        <h1 className="text-[26px] font-normal tracking-tight text-ink sm:text-[28px]">{customer.name}</h1>
        <div className="text-sm text-ink-secondary">
          {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info on file"}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Surface className="p-4">
          <div className="text-xs text-ink-muted">Total spend</div>
          <div className="mt-1 text-lg font-semibold">{formatBaht(customer.totalSpend)}</div>
        </Surface>
        <Surface className="p-4">
          <div className="text-xs text-ink-muted">Visits</div>
          <div className="mt-1 text-lg font-semibold">{customer.visitCount}</div>
        </Surface>
        <Surface className="p-4">
          <div className="text-xs text-ink-muted">No-shows</div>
          <div className="mt-1 text-lg font-semibold">{customer.noShowCount}</div>
        </Surface>
        <Surface className="p-4">
          <div className="text-xs text-ink-muted">Last visit</div>
          <div className="mt-1 text-lg font-semibold">{formatLastVisit(customer.lastVisit)}</div>
        </Surface>
      </div>

      <div className="mt-6 grid max-w-[640px] grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">Notes</div>
          <Surface className="mt-2 p-4">
            <NotesForm customerId={customer.id} notes={customer.notes ?? ""} />
          </Surface>
        </div>
        <div>
          <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">Tags</div>
          <Surface className="mt-2 p-4">
            <TagsForm customerId={customer.id} tags={customer.tags} />
          </Surface>
        </div>
      </div>

      <div className="mt-8">
        <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          Upcoming ({upcoming.length})
        </div>
        <div className="mt-2">
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
              No upcoming bookings.
            </div>
          ) : (
            <BookingList>
              {upcoming.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </BookingList>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          History ({past.length})
        </div>
        <div className="mt-2">
          {past.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
              No past bookings yet.
            </div>
          ) : (
            <BookingList>
              {past.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </BookingList>
          )}
        </div>
      </div>
    </PageShell>
  );
}
