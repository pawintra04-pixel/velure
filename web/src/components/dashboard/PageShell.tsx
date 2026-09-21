import type { ReactNode } from "react";

// The one outer grid every owner-facing dashboard page shares — gutters,
// vertical rhythm, and a small set of intentional content widths, all
// modeled on Overview's own shell (the strongest existing reference) so
// every page reads as the same application instead of an independently
// max-width'd component dropped on a canvas.
//
// - "standard" (1320px, matches Overview): normal management pages —
//   Bookings, Customers, Services, Team, Classes, Resources.
// - "wide" (1600px): operational/data-heavy workspaces that benefit from
//   real desktop width — Calendar, Reports.
// - "readable" content width is a separate, narrower cap applied *inside*
//   a standard/wide shell for form-heavy content (see ReadableSection
//   below) — it is never its own outer shell.
const MAX_WIDTH = {
  standard: "max-w-[1320px]",
  wide: "max-w-[1600px]",
} as const;

export function PageShell({
  width = "standard",
  className = "",
  children,
}: {
  width?: keyof typeof MAX_WIDTH;
  /** Extra classes appended after the width cap — e.g. `print:max-w-none` for a print-friendly page. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`font-didact mx-auto ${MAX_WIDTH[width]} px-6 py-8 sm:px-10 sm:py-10 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}

// The title/description/actions row every page opens with — same
// typographic scale and alignment as Overview's own header.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{actions}</div>}
    </div>
  );
}

// A narrower content cap for form-heavy sections (Settings) placed inside a
// standard/wide PageShell — keeps fields comfortably readable instead of
// stretched edge-to-edge, without introducing a fourth outer shell width.
export function ReadableSection({ children }: { children: ReactNode }) {
  return <div className="max-w-[640px]">{children}</div>;
}

// The one grouping surface for "several controls/data points that form one
// functional unit" (settings sections, toolbars, empty/setup states) — thin
// border, restrained radius, no shadow. Not every element gets this; see
// each page for where it's actually used.
export function Surface({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-6 ${className}`}>{children}</div>
  );
}
