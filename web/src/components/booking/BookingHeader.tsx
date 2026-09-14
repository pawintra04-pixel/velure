import Link from "next/link";

/**
 * Persistent header across every customer-facing /book/* page (choose
 * service, pick time, details, pay, confirmed, manage). Customers never
 * log in, so there's no "my bookings" page to send them to — clicking the
 * business name just returns to the start of that business's booking flow,
 * giving every page a way back rather than being a dead-end floating card.
 */
export function BookingHeader({
  businessName,
  slug,
  logoUrl,
}: {
  businessName: string;
  slug: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-6 py-4 lg:px-10">
        <Link href={`/book/${slug}`} className="flex items-center gap-2.5 hover:opacity-70">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- owner-pasted external URL, not a static/optimizable asset
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          )}
          <span className="text-lg font-semibold tracking-tight">{businessName}</span>
        </Link>
      </div>
    </header>
  );
}
