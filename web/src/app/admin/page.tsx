import { requireAdmin } from "@/lib/admin-auth";
import { getPlatformOverview, listBusinessSummaries, listRecentErrors } from "@/lib/admin-data";
import { formatBaht } from "@/lib/money";
import { PageShell, PageHeader, Surface } from "@/components/dashboard/PageShell";
import { adminLogOut } from "./login/actions";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [overview, businesses, errors] = await Promise.all([
    getPlatformOverview(),
    listBusinessSummaries(),
    listRecentErrors(20),
  ]);

  return (
    <PageShell width="wide">
      <div className="flex items-start justify-between border-b border-border pb-5">
        <PageHeader title="Platform admin" description={`Signed in as ${admin.email}`} />
        <form action={adminLogOut}>
          <button
            type="submit"
            className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          >
            Log out
          </button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Surface>
          <div className="text-xs text-ink-muted">Businesses</div>
          <div className="mt-1 text-2xl font-semibold">{overview.businessCount}</div>
        </Surface>
        <Surface>
          <div className="text-xs text-ink-muted">New in last 30 days</div>
          <div className="mt-1 text-2xl font-semibold">{overview.newBusinessesLast30d}</div>
        </Surface>
        <Surface>
          <div className="text-xs text-ink-muted">Settled bookings</div>
          <div className="mt-1 text-2xl font-semibold">{overview.totalBookings}</div>
        </Surface>
        <Surface>
          <div className="text-xs text-ink-muted">Total processed revenue</div>
          <div className="mt-1 text-2xl font-semibold">{formatBaht(overview.totalRevenue)}</div>
        </Surface>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Revenue collected by businesses through Velure — not Velure&apos;s own revenue (see
        README: no platform subscription/commission billing exists yet).
      </p>

      <div className="mt-8">
        <h2 className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          Businesses ({businesses.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page text-left text-xs text-ink-muted">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Signed up</th>
                <th className="px-4 py-2 font-medium">Stripe</th>
                <th className="px-4 py-2 text-right font-medium">Bookings</th>
                <th className="px-4 py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                    No businesses signed up yet.
                  </td>
                </tr>
              )}
              {businesses.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-ink-muted">/{b.slug}</div>
                  </td>
                  <td className="px-4 py-2 text-ink-secondary">{b.ownerEmail ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-secondary">{formatDateTime(b.createdAt)}</td>
                  <td className="px-4 py-2">
                    {b.hasStripeAccount ? (
                      <span className="rounded-full bg-[#e8f5ee] px-2 py-0.5 text-xs text-[#1b8a5a]">
                        Connected
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#fdf3e6] px-2 py-0.5 text-xs text-[#a8681c]">
                        Not connected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{b.bookingCount}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatBaht(b.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          Recent errors ({errors.length})
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Uncaught server errors only — a booking&apos;s own validation messages (e.g. &quot;slot
          already taken&quot;) never show up here.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {errors.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
              No errors recorded.
            </div>
          )}
          {errors.map((e) => (
            <div key={e.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-ink-muted">
                  {formatDateTime(e.occurredAt)} · {e.routeType ?? "unknown"} ·{" "}
                  {e.routePath ?? "unknown path"}
                  {e.businessName && ` · ${e.businessName}`}
                </span>
              </div>
              <div className="mt-1 text-[#d03b3b]">{e.message}</div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
