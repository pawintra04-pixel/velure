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

// The iframe points straight at the same public booking page a plain link
// opens — no separate embeddable booking implementation, so tenant
// isolation, availability, and payment all stay exactly as correct as they
// already are outside an iframe. The inline script only does one thing:
// listen for this page's own height (posted by EmbedAutoResize, mounted on
// every /book/* page) and resize the iframe to match, since a fixed height
// would either clip content or leave dead space as the visitor moves
// through service -> time -> details -> pay. event.source is checked so a
// host page with other iframes/scripts on it can't have some unrelated
// postMessage resize this one.
function embedSnippet(elementId: string, url: string, title: string): string {
  return `<iframe id="${elementId}" src="${url}" title="${title}" style="width:100%;height:900px;border:0;display:block" loading="lazy"></iframe>
<script>
(function () {
  var iframe = document.getElementById("${elementId}");
  window.addEventListener("message", function (e) {
    if (e.source !== iframe.contentWindow) return;
    if (!e.data || e.data.type !== "velure:resize") return;
    iframe.style.height = e.data.height + "px";
  });
})();
</script>`;
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const owner = await requireOwner();
  const { tag } = await searchParams;
  const source = tag?.trim() ?? "";

  const { slug, businessName, services } = await withBusinessContext(owner.businessId, async (c) => {
    const { rows: [business] } = await c.query<{ slug: string; name: string }>(
      `SELECT slug, name FROM businesses WHERE id = $1`,
      [owner.businessId]
    );
    const { rows: services } = await c.query<{ id: string; name: string }>(
      `SELECT id, name FROM services ORDER BY name`
    );
    return { slug: business.slug, businessName: business.name, services };
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

      <div className="mt-8">
        <div className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          Embed on your website
        </div>
        <p className="mt-2 max-w-xl text-sm text-ink-secondary">
          Paste this into your site&apos;s HTML to show the booking page right on your own
          website. It resizes itself automatically as visitors move through it.
        </p>

        <Surface className="mt-3 p-5">
          <div className="font-medium">Whole booking page</div>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-page p-3 font-mono text-xs text-ink-secondary">
            {embedSnippet(`velure-embed-${slug}`, businessUrl, `Book with ${businessName}`)}
          </pre>
          <div className="mt-2">
            <CopyButton
              text={embedSnippet(`velure-embed-${slug}`, businessUrl, `Book with ${businessName}`)}
              label="Copy embed code"
            />
          </div>
        </Surface>

        {serviceLinks.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {serviceLinks.map((s) => {
              const snippet = embedSnippet(`velure-embed-${s.id}`, s.url, `Book ${s.name} with ${businessName}`);
              return (
                <details key={s.id} className="rounded-2xl border border-border bg-surface p-5">
                  <summary className="cursor-pointer font-medium">{s.name}</summary>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-page p-3 font-mono text-xs text-ink-secondary">
                    {snippet}
                  </pre>
                  <div className="mt-2">
                    <CopyButton text={snippet} label="Copy embed code" />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
