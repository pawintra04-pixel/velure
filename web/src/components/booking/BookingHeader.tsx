import Link from "next/link";

/**
 * Persistent header across every customer-facing /book/* page (choose
 * service, pick time, details, pay, confirmed, manage). Customers never
 * log in, so there's no "my bookings" page to send them to — clicking the
 * business name just returns to the start of that business's booking flow,
 * giving every page a way back rather than being a dead-end floating card.
 */
export function BookingHeader({ businessName, slug }: { businessName: string; slug: string }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-4 lg:px-10">
        <Link href={`/book/${slug}`} className="text-lg font-semibold tracking-tight hover:opacity-70">
          {businessName}
        </Link>
      </div>
    </header>
  );
}
