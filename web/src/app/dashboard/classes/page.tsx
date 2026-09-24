import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { withBusinessContext } from "@/db/client";
import { CreateSessionForm } from "./CreateSessionForm";
import { cancelClassSession, deleteClassSession, updateClassSessionNote } from "./actions";
import { PageShell, PageHeader } from "@/components/dashboard/PageShell";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { classesText, tCancelSessionDesc, type Locale } from "@/lib/i18n";

function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function ClassesPage() {
  const owner = await requireOwner();
  const locale = owner.locale;
  const t = classesText[locale];

  const { sessions, classServices, staff, resources } = await withBusinessContext(
    owner.businessId,
    async (c) => {
      const sessionsResult = await c.query(
        `SELECT cs.id, cs.start_time, cs.capacity, cs.seats_booked, cs.owner_note, cs.is_flagged, cs.series_id,
                s.name AS service_name, st.name AS staff_name, r.name AS resource_name
         FROM class_sessions cs
         JOIN services s ON s.id = cs.service_id
         JOIN staff st ON st.id = cs.staff_id
         LEFT JOIN resources r ON r.id = cs.resource_id
         WHERE cs.start_time >= now()
         ORDER BY cs.start_time`
      );
      const classServicesResult = await c.query(
        `SELECT id, name FROM services WHERE capacity IS NOT NULL AND capacity >= 2 ORDER BY name`
      );
      const staffResult = await c.query(`SELECT id, name FROM staff ORDER BY name`);
      // Only rooms currently in service can be assigned to a NEW session —
      // one closed "temporarily" (see Resources) shouldn't be offered here
      // even though its existing sessions/bookings are untouched.
      const resourcesResult = await c.query(
        `SELECT id, name FROM resources WHERE is_active ORDER BY name`
      );
      return {
        sessions: sessionsResult.rows,
        classServices: classServicesResult.rows,
        staff: staffResult.rows,
        resources: resourcesResult.rows,
      };
    }
  );

  const hasClassServices = classServices.length > 0;

  return (
    <PageShell width="standard">
      <div className="border-b border-border pb-5">
        <PageHeader
          title={t.title}
          description={t.description}
        />
      </div>

      {!hasClassServices ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-8">
          <div className="text-[15px] text-ink">{t.notSetUpTitle}</div>
          <p className="max-w-md text-sm text-ink-secondary">
            {t.notSetUpDesc}
          </p>
          <Link
            href="/dashboard/services"
            className="rounded-lg bg-sunburst px-4 py-2 text-sm font-medium text-ink transition-[filter] hover:brightness-95"
          >
            {t.goToServices}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3">
            {sessions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
                {t.noUpcomingSessions}
              </div>
            )}
            {groupSessions(sessions as SessionRow[]).map((g) =>
              g.sessions.length === 1 ? (
                <SessionCard key={g.key} s={g.sessions[0]} locale={locale} />
              ) : (
                <SeriesCard key={g.key} sessions={g.sessions} locale={locale} />
              )
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-[13.5px] font-semibold uppercase tracking-wide text-ink">
              {t.scheduleSession}
            </h2>
            <div className="mt-2">
              <CreateSessionForm services={classServices} staff={staff} resources={resources} locale={locale} />
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}

type SessionRow = {
  id: string;
  start_time: string;
  capacity: number;
  seats_booked: number;
  owner_note: string | null;
  is_flagged: boolean;
  series_id: string | null;
  service_name: string;
  staff_name: string;
  resource_name: string | null;
};

// Sessions from one "repeat weekly" run share a series_id and collapse into
// one SeriesCard; everything else (one-offs, and sessions created before
// series_id existed) stays its own card. Order follows each group's next
// upcoming occurrence, since `sessions` is already sorted by start_time.
function groupSessions(sessions: SessionRow[]): { key: string; sessions: SessionRow[] }[] {
  const groups: { key: string; sessions: SessionRow[] }[] = [];
  const bySeries = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.series_id) {
      groups.push({ key: s.id, sessions: [s] });
      continue;
    }
    let list = bySeries.get(s.series_id);
    if (!list) {
      list = [];
      bySeries.set(s.series_id, list);
      groups.push({ key: s.series_id, sessions: list });
    }
    list.push(s);
  }
  return groups;
}

function SeriesCard({ sessions, locale }: { sessions: SessionRow[]; locale: Locale }) {
  const t = classesText[locale];
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const intlLocale = locale === "th" ? "th-TH" : "en-US";
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale, { timeZone: "Asia/Bangkok", weekday: "short" });
  const dayIndexFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" });
  const ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekdays = [...new Map(sessions.map((s) => [dayIndexFmt.format(new Date(s.start_time)), s])).entries()]
    .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    .map(([, s]) => weekdayFmt.format(new Date(s.start_time)));
  const time = new Intl.DateTimeFormat(intlLocale, { timeZone: "Asia/Bangkok", timeStyle: "short" }).format(
    new Date(first.start_time)
  );
  const dateFmt = new Intl.DateTimeFormat(intlLocale, { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
  const seatsTotal = sessions.reduce((n, s) => n + s.seats_booked, 0);
  const staffNames = [...new Set(sessions.map((s) => s.staff_name))].join(", ");

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {first.service_name}
            <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-normal text-ink-secondary">
              🔁 {t.repeatsWeekly}
            </span>
          </div>
          <div className="mt-1 text-sm text-ink-muted">
            {weekdays.join(" · ")} {time} · {staffNames}
            {first.resource_name && <> · {first.resource_name}</>}
          </div>
          <div className="mt-1 text-sm text-ink-muted">
            {dateFmt.format(new Date(first.start_time))} – {dateFmt.format(new Date(last.start_time))} ·{" "}
            {sessions.length} {t.sessionsUnit} {t.upcomingLeft}
          </div>
        </div>
        <div className="shrink-0 text-sm text-ink-secondary sm:text-right">
          <div>
            {t.nextSession}: {formatTime(first.start_time, locale)}
          </div>
          <div className="text-ink-muted">
            {seatsTotal} {t.seatsTotal}
          </div>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink-secondary hover:text-ink">
          {t.showAllSessions} ({sessions.length})
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} s={s} locale={locale} inSeries />
          ))}
        </div>
      </details>
    </div>
  );
}

function SessionCard({ s, locale, inSeries = false }: { s: SessionRow; locale: Locale; inSeries?: boolean }) {
  const t = classesText[locale];
  return (
    <div
      id={`class-${s.id}`}
      className={`border bg-surface ${inSeries ? "rounded-xl p-3" : "rounded-2xl p-5"} ${
        s.is_flagged ? "border-[#a8681c]/40 bg-[#fdf3e6]/40" : "border-border"
      }`}
    >
      {/* sm:flex-wrap: see StaffCard.tsx for why — the Remove trigger
          can render a full-sentence error below itself, which needs
          the button cluster free to drop to its own line rather than
          starving the min-w-0 name/detail column next to it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          {!inSeries && (
            <div className="flex items-center gap-1.5 font-medium">
              {s.is_flagged && <span title="Flagged for special attention">📌</span>}
              {s.service_name}
            </div>
          )}
          <div className={inSeries ? "text-sm text-ink" : "mt-1 text-sm text-ink-muted"}>
            {inSeries && s.is_flagged && "📌 "}
            {formatTime(s.start_time, locale)} · {s.staff_name}
            {s.resource_name && <> · {s.resource_name}</>}
          </div>
          {s.owner_note && <div className="mt-1 text-sm text-[#a8681c]">{s.owner_note}</div>}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
          <div className="text-sm text-ink-secondary">
            {s.seats_booked} / {s.capacity} {t.booked}
          </div>
          {s.seats_booked > 0 && (
            <ConfirmSubmitButton
              action={cancelClassSession}
              hiddenFields={{ sessionId: s.id }}
              label={t.cancelSession}
              pendingLabel={t.cancelling}
              confirmTitle={t.cancelSessionTitle}
              confirmDescription={tCancelSessionDesc(locale, s.seats_booked)}
              confirmLabel={t.cancelSession}
              cancelLabel={t.goBack}
              danger
              buttonClassName="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
            />
          )}
          <ConfirmSubmitButton
            action={deleteClassSession}
            hiddenFields={{ sessionId: s.id }}
            label={t.removeSession}
            pendingLabel={t.removing}
            confirmTitle={t.removeSessionTitle}
            confirmDescription={t.removeSessionDesc}
            confirmLabel={t.removeSession}
            cancelLabel={t.goBack}
            danger
            buttonClassName="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          />
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink-secondary">
          {t.noteAndFlag}
        </summary>
        <form
          action={updateClassSessionNote}
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="sessionId" value={s.id} />
          <input
            name="note"
            defaultValue={s.owner_note ?? ""}
            placeholder={t.notePlaceholder}
            className="flex-1 rounded-lg border border-border px-3 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-sm text-ink-secondary">
            <input type="checkbox" name="flagged" defaultChecked={s.is_flagged} />
            {t.flag}
          </label>
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-page"
          >
            {t.save}
          </button>
        </form>
      </details>
    </div>
  );
}
