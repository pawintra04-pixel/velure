import Link from "next/link";

const TONE_VARS: Record<string, { bg: string; ink: string }> = {
  green: { bg: "--tint-green-bg", ink: "--tint-green-ink" },
  amber: { bg: "--tint-amber-bg", ink: "--tint-amber-ink" },
  blue: { bg: "--tint-blue-bg", ink: "--tint-blue-ink" },
  pink: { bg: "--tint-pink-bg", ink: "--tint-pink-ink" },
};

export function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONE_VARS;
  /** When set, the whole card links out (e.g. to the bookings list filtered to match). */
  href?: string;
}) {
  const t = tone ? TONE_VARS[tone] : null;

  const content = (
    <>
      <div className="text-sm" style={t ? { color: `var(${t.ink})` } : undefined}>
        {!t && <span className="text-ink-secondary">{label}</span>}
        {t && label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {hint && (
        <div
          className="mt-1 text-xs"
          style={t ? { color: `var(${t.ink})`, opacity: 0.75 } : undefined}
        >
          {!t && <span className="text-ink-muted">{hint}</span>}
          {t && hint}
        </div>
      )}
    </>
  );

  const className = `block rounded-2xl p-5 ${t ? "" : "border border-border bg-surface"} ${
    href ? "transition-opacity hover:opacity-80" : ""
  }`;
  const style = t ? { backgroundColor: `var(${t.bg})` } : undefined;

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
