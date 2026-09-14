import Link from "next/link";
import { getDemoBusinessId } from "@/lib/demo-business";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";

// STUB: single hardcoded demo business, same as the dashboard. A real
// booking page is reached per-business (custom domain or /book/[business]),
// not a single global route — see docs/ARCHITECTURE.md's embed/standalone
// requirement. Out of scope for proving the hold+payment flow end to end.
export default async function BookServicesPage() {
  const businessId = await getDemoBusinessId();

  const services = await withBusinessContext(businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name, duration_minutes, price_amount, payment_mode, deposit_amount
       FROM services ORDER BY name`
    );
    return rows;
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Choose a service</h1>
      <p className="mt-1 text-sm text-ink-secondary">Velure Demo Spa</p>

      <div className="mt-6 flex flex-col gap-3">
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/book/${s.id}`}
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
