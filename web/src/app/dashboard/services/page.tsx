import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { formatBaht } from "@/lib/money";
import { AddServiceForm } from "./AddServiceForm";
import { deleteService } from "./actions";

export default async function ServicesPage() {
  const owner = await requireOwner();

  const services = await withBusinessContext(owner.businessId, async (c) => {
    const { rows } = await c.query(
      `SELECT id, name, duration_minutes, buffer_minutes, price_amount, payment_mode, deposit_amount
       FROM services ORDER BY created_at`
    );
    return rows;
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Services</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          What customers can book on your public booking page.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {services.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-ink-muted">
              No services yet — add your first one below.
            </div>
          )}
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5"
            >
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="mt-1 text-sm text-ink-muted">
                  {s.duration_minutes} min
                  {s.buffer_minutes > 0 && ` + ${s.buffer_minutes} min buffer`}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-semibold">
                    {formatBaht(s.payment_mode === "deposit" ? s.deposit_amount : s.price_amount)}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {s.payment_mode === "deposit"
                      ? "Deposit"
                      : s.payment_mode === "free"
                        ? "Free"
                        : "Full payment"}
                  </div>
                </div>
                <form action={deleteService}>
                  <input type="hidden" name="serviceId" value={s.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-medium text-ink-secondary">Add a service</h2>
          <AddServiceForm />
        </div>
    </div>
  );
}
