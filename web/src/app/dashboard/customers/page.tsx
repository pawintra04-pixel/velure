import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { searchCustomers, listUsedTags } from "@/lib/customers-data";
import { formatBaht } from "@/lib/money";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { customersText, tCustomerCount, tNoShowCount, type Locale } from "@/lib/i18n";

function formatLastVisit(iso: string | null, locale: Locale, never: string): string {
  if (!iso) return never;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = customersText[locale];
  const { q, tag } = await searchParams;
  const [customers, usedTags] = await Promise.all([
    searchCustomers(owner.businessId, q?.trim() || null, tag?.trim() || null),
    listUsedTags(owner.businessId),
  ]);

  return (
    <PageShell width="wide">
      <div className="border-b border-border pb-5">
        <PageHeader
          title={t.title}
          description={t.description}
          actions={
            <form action="/dashboard/customers" className="flex flex-wrap items-center gap-2">
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm sm:w-72"
              />
              {usedTags.length > 0 && (
                <select
                  name="tag"
                  defaultValue={tag ?? ""}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="">{t.allTags}</option>
                  {usedTags.map((tg) => (
                    <option key={tg} value={tg}>
                      {tg}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-page"
              >
                {t.filter}
              </button>
            </form>
          }
        />
      </div>

      <div className="mt-6">
        {customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            {q || tag ? t.noCustomersFilter : t.noCustomersYet}
          </div>
        ) : (
          <>
            <div className="mb-3 text-[13px] text-ink-muted">{tCustomerCount(locale, customers.length)}</div>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-page text-left text-xs text-ink-muted">
                    <th className="px-4 py-2 font-medium">{t.colName}</th>
                    <th className="px-4 py-2 font-medium">{t.colTags}</th>
                    <th className="px-4 py-2 font-medium">{t.colLastVisit}</th>
                    <th className="px-4 py-2 text-right font-medium">{t.colBookings}</th>
                    <th className="px-4 py-2 text-right font-medium">{t.colTotalSpend}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust) => (
                    <tr key={cust.id} className="border-b border-border last:border-0 hover:bg-page">
                      <td className="px-4 py-2">
                        <Link href={`/dashboard/customers/${cust.id}`} className="block">
                          <div className="truncate text-[14.5px] text-ink">{cust.name}</div>
                          <div className="truncate text-[13px] text-ink-muted">
                            {[cust.phone, cust.email].filter(Boolean).join(" · ") || t.noContactInfo}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {cust.tags.map((tg) => (
                            <span
                              key={tg}
                              className="rounded-full bg-[#eaf1fb] px-2 py-0.5 text-xs text-[#3462ad]"
                            >
                              {tg}
                            </span>
                          ))}
                          {cust.noShowCount > 0 && (
                            <span className="rounded-full bg-[#fbeef2] px-2 py-0.5 text-xs text-[#b34a6b]">
                              {tNoShowCount(locale, cust.noShowCount)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-ink-secondary">{formatLastVisit(cust.lastVisit, locale, t.never)}</td>
                      <td className="px-4 py-2 text-right">{cust.bookingCount}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatBaht(cust.totalSpend)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
