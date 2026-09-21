import Link from "next/link";

// "All" here means "everything still relevant to act on" — cancelled/
// no-show/failed/refunded bookings are deliberately excluded from it and
// live behind their own pill instead, so the default list stops growing
// forever as a business accumulates history. Matches ListView's own
// ACTIVE_STATUSES filter in page.tsx.
const CATEGORIES = [
  { key: "active", label: "All", status: null as string | null },
  { key: "paid", label: "Paid", status: "CONFIRMED" },
  { key: "unpaid", label: "Unpaid", status: "TEMPORARY_HOLD,PAYMENT_PENDING" },
  { key: "completed", label: "Completed", status: "COMPLETED" },
  {
    key: "cancelled",
    label: "Cancelled",
    status: "CANCELLED,NO_SHOW,PAYMENT_FAILED,EXPIRED,REFUNDED,PARTIALLY_REFUNDED",
  },
];

export function CategoryTabs({ activeStatus }: { activeStatus: string | null }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) => {
        const isActive = cat.status === activeStatus;
        const href = cat.status
          ? `/dashboard/bookings?view=list&status=${cat.status}`
          : `/dashboard/bookings?view=list`;
        return (
          <Link
            key={cat.key}
            href={href}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              isActive ? "bg-midnight text-sunburst" : "border border-border text-ink-secondary hover:bg-page"
            }`}
          >
            {cat.label}
          </Link>
        );
      })}
    </div>
  );
}
