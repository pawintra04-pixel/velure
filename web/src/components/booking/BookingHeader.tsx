import Link from "next/link";
import { getCurrentCustomer } from "@/lib/customer-auth";

/**
 * Persistent header across every customer-facing /book/* page (choose
 * service, pick time, details, pay, confirmed, manage). Clicking the
 * business name returns to the start of that business's booking flow,
 * giving every page a way back rather than being a dead-end floating
 * card. Also shows "My bookings" / "Log in" — an async Server Component
 * so it can check the customer session itself rather than every one of
 * its ~6 call sites having to fetch and pass it down.
 */
export async function BookingHeader({
  businessName,
  slug,
  businessId,
  logoUrl,
}: {
  businessName: string;
  slug: string;
  businessId: string;
  logoUrl?: string | null;
}) {
  const customer = await getCurrentCustomer();
  const loggedInHere = customer?.businessId === businessId;

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2.5 px-6 py-4 lg:px-10">
        <Link href={`/book/${slug}`} className="flex items-center gap-2.5 hover:opacity-70">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- owner-pasted external URL, not a static/optimizable asset
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          )}
          <span className="text-lg font-semibold tracking-tight">{businessName}</span>
        </Link>
        <Link
          href={loggedInHere ? `/book/${slug}/account` : `/book/${slug}/login`}
          className="text-sm text-ink-secondary underline-offset-2 hover:underline"
        >
          {loggedInHere ? "My bookings" : "Log in"}
        </Link>
      </div>
    </header>
  );
}
