import QRCode from "qrcode";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { PageShell, PageHeader, Surface } from "@/components/dashboard/PageShell";
import { CopyButton } from "./CopyButton";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

function withSource(url: string, source: string): string {
  return source ? `${url}?src=${encodeURIComponent(source)}` : url;
}

async function qrDataUrl(url: string): Promise<string> {
  // Server-side generation (not the browser build) — no client bundling
  // concerns, and the tag/source form below is a plain GET so the whole
  // page (link text + QR image) just re-renders on submit, same pattern
  // the Customers page's tag filter already uses.
  return QRCode.toDataURL(url, { width: 240, margin: 1 });
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const owner = await requireOwner();
  const { tag } = await searchParams;
  const source = tag?.trim() ?? "";

  const { slug, services } = await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [business] } = await c.query<{ slug: string }>(
      `SELECT slug FROM businesses WHERE id = $1`,
      [owner.businessId]
    );
    const { rows: services } = await c.query<{ id: string; name: string }>(
      `SELECT id, name FROM services ORDER BY name`
    );
    return { slug: business.slug, services };
  });

  const businessUrl = withSource(`${APP_BASE_URL}/book/${slug}`, source);
  const businessQr = await qrDataUrl(businessUrl);

  const serviceLinks = await Promise.all(
    services.map(async (s) => {
      const url = withSource(`${APP_BASE_URL}/book/${slug}/${s.id}`, source);
      return { id: s.id, name: s.name, url, qr: await qrDataUrl(url) };
    })
  );

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader
          title="Share"
          description="Booking links and QR codes to put on your reception counter, business cards, or social media."
        />
      </div>

      <div className="mt-6 max-w-md">
        <form action="/dashboard/share" className="flex items-center gap-2">
          <input
            name="tag"
            defaultValue={source}
            placeholder="Optional source label, e.g. reception, instagram"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-page">
            Apply
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          A label here gets added to every link/QR below, so bookings from that link are tagged
          with it — see each customer&apos;s record, or a future Reports breakdown by source.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          Your booking page
        </div>
        <Surface className="flex flex-wrap items-center gap-5 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URI, not a static asset */}
          <img src={businessQr} alt="" className="h-24 w-24 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-sm text-ink-secondary">{businessUrl}</div>
            <div className="mt-2">
              <CopyButton text={businessUrl} />
            </div>
          </div>
        </Surface>
      </div>

      {serviceLinks.length > 0 && (
        <div className="mt-8">
          <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
            Individual services
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {serviceLinks.map((s) => (
              <Surface key={s.id} className="flex flex-wrap items-center gap-5 p-5">
                {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URI, not a static asset */}
                <img src={s.qr} alt="" className="h-20 w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="truncate font-mono text-sm text-ink-secondary">{s.url}</div>
                  <div className="mt-2">
                    <CopyButton text={s.url} />
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
