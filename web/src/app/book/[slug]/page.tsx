import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/business";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";

export default async function BookServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  const services = await withBusinessContext(business.id, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name, duration_minutes, price_amount, payment_mode, deposit_amount
       FROM services ORDER BY name`
    );
    return rows;
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Choose a service</h1>
      <p className="mt-1 text-sm text-ink-secondary">{business.name}</p>

      <div className="mt-6 flex flex-col gap-3">
        {services.length === 0 && (
          <div className="text-sm text-ink-muted">No services available yet.</div>
        )}
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/book/${slug}/${s.id}`}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 hover:border-accent"
          >
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="mt-1 text-sm text-ink-muted">{s.duration_minutes} min</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {formatBaht(s.payment_mode === "deposit" ? s.deposit_amount : s.price_amount)}
              </div>
              {s.payment_mode === "deposit" && (
                <div className="text-xs text-ink-muted">Deposit</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
