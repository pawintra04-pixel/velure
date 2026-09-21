import Link from "next/link";
import type { TodayScheduleEntry } from "@/lib/dashboard-data";
import { statusMeta } from "@/lib/booking-status";

// Cycles rows through the app's existing pastel tint tokens (same ones
// service-color.ts uses for services) so a given customer/service always
// gets the same avatar tone — cosmetic only, not a real identity system.
const AVATAR_TONES = ["--tint-blue-bg", "--tint-green-bg", "--tint-amber-bg", "--tint-pink-bg"];
function avatarBg(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `var(${AVATAR_TONES[hash % AVATAR_TONES.length]})`;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatCountdown(iso: string, nowMs: number): string | null {
  const diffMin = Math.round((new Date(iso).getTime() - nowMs) / 60_000);
  if (diffMin < 0) return null;
  if (diffMin < 60) return `in ${diffMin} minute${diffMin === 1 ? "" : "s"}`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return null;
}

// Where "now" falls among today's rows, as an insertion index (never at
// position 0 or entries.length — only between two real rows) — omitted
// entirely once today's schedule is over or hasn't started, rather than
// pinned to the top/bottom edge.
function nowLineIndex(entries: TodayScheduleEntry[], nowMs: number): number | null {
  if (entries.length < 2) return null;
  const first = new Date(entries[0].startTime).getTime();
  const last = new Date(entries[entries.length - 1].startTime).getTime();
  if (nowMs < first || nowMs >= last) return null;
  for (let i = 0; i < entries.length - 1; i++) {
    const cur = new Date(entries[i].startTime).getTime();
    const next = new Date(entries[i + 1].startTime).getTime();
    if (nowMs >= cur && nowMs < next) return i + 1;
  }
  return null;
}

const VISIBLE_ROWS = 6;

function Row({ entry }: { entry: TodayScheduleEntry }) {
  const meta = entry.status ? statusMeta(entry.status) : null;
  const initial = entry.title.trim().charAt(0).toUpperCase() || "?";
  // Service names already bake duration into the name itself (e.g. "Thai
  // Massage (60 min)") — the same convention BookingRow.tsx's subtitle
  // relies on — so it's not appended again here.
  const subtitle = `${entry.serviceName} · ${entry.staffName}${
    entry.resourceName ? ` · ${entry.resourceName}` : ""
  }`;
  const muted = meta?.strike;

  return (
    <div className="flex items-start gap-3 border-b border-border py-4 last:border-b-0 sm:items-center sm:gap-4">
      <span className="hidden w-12 shrink-0 pt-0.5 font-mono text-[13px] text-ink-muted sm:block sm:pt-0">
        {formatTime(entry.startTime)}
      </span>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-medium"
        style={{ background: avatarBg(entry.title), color: "var(--ink)", opacity: muted ? 0.5 : 1 }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate text-[16px] ${muted ? "text-ink-muted line-through" : "text-ink"}`}
          >
            {entry.isFlagged && <span className="mr-1" title="Flagged for special attention">📌</span>}
            {entry.title}
          </span>
          <span className="shrink-0 font-mono text-[13px] text-ink-muted sm:hidden">
            {formatTime(entry.startTime)}
          </span>
        </div>
        <div className={`mt-0.5 truncate text-[13px] ${muted ? "text-ink-muted" : "text-ink-secondary"}`}>
          {subtitle}
        </div>
        {entry.ownerNote && <div className="mt-1 truncate text-[13px] text-[#a8681c]">{entry.ownerNote}</div>}
        {entry.kind === "class" ? (
          <div className="mt-1.5 sm:hidden">
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[12px] font-medium text-ink-secondary">
              {entry.seatsBooked}/{entry.capacity} seats
            </span>
          </div>
        ) : (
          meta && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] sm:hidden" style={{ color: meta.color }}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </div>
          )
        )}
      </div>
      {entry.kind === "class" ? (
        <span className="hidden shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[12.5px] font-medium text-ink-secondary sm:block">
          {entry.seatsBooked}/{entry.capacity} seats
        </span>
      ) : (
        meta && (
          <span className="hidden shrink-0 items-center gap-1.5 text-[13px] sm:flex" style={{ color: meta.color }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
        )
      )}
    </div>
  );
}

function NowLine() {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-sunburst" />
      <span className="h-px flex-1 bg-sunburst" />
      <span className="rounded-md bg-soft-yellow-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
        {label}
      </span>
    </div>
  );
}

// Rendered by the Overview page ABOVE the two-column grid (full width),
// per the locked "Today / Up next hierarchy" composition — not nested
// inside the schedule column.
export function UpNextLine({ entries }: { entries: TodayScheduleEntry[] }) {
  const nowMs = new Date().getTime();
  const upNext = entries.find((e) => new Date(e.startTime).getTime() > nowMs);
  const countdown = upNext ? formatCountdown(upNext.startTime, nowMs) : null;
  if (!upNext || !countdown) return null;

  return (
    <div className="flex items-center gap-2 text-[14px] text-ink-secondary">
      <span className="h-2 w-2 shrink-0 rounded-full bg-sunburst" />
      <span>
        Up next &mdash; <span className="text-[15px] text-ink">{upNext.title}</span>,{" "}
        {upNext.serviceName} with {upNext.staffName}, {countdown}
      </span>
    </div>
  );
}

export function TodaySchedule({ entries }: { entries: TodayScheduleEntry[] }) {
  const nowMs = new Date().getTime();
  const insertAt = nowLineIndex(entries, nowMs);
  const visible = entries.slice(0, VISIBLE_ROWS);
  const remaining = entries.length - visible.length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold uppercase tracking-wide text-ink">
          Today&rsquo;s schedule
        </div>
        <Link href="/dashboard/calendar" className="text-[13.5px] text-ink hover:underline">
          Open calendar &rarr;
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-[14px] text-ink-muted">
          Nothing scheduled today
        </div>
      ) : (
        <div className="relative mt-3">
          {visible.map((entry, i) => (
            <div key={`${entry.kind}-${entry.id}`}>
              {insertAt === i && <NowLine />}
              <Row entry={entry} />
            </div>
          ))}
          {insertAt === visible.length && <NowLine />}
        </div>
      )}

      {remaining > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-4 text-[13.5px] text-ink-muted">
          <span>
            +{remaining} more later today
          </span>
          <Link href="/dashboard/calendar" className="text-ink hover:underline">
            Open calendar &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
