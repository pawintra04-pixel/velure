"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchRescheduleSlots, rescheduleBooking, cancelBooking } from "./actions";
import type { Slot } from "@/lib/availability";
import type { Locale } from "@/lib/i18n";
import { publicText, intlLocale, tRescheduleCutoff, tCancelCutoff, tMovedTo, tPaidAmount, type PublicText } from "@/lib/i18n-public";

function nextDays(n: number, locale: Locale): { iso: string; weekday: string; day: string }[] {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
    // Seven columns must fit a phone: Thai "narrow" gives จ / อ / พฤ, while
    // English short names are trimmed to two letters ("Mon" -> "Mo").
    const weekday =
      locale === "th"
        ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "narrow" }).format(d)
        : new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" }).format(d).slice(0, 2);
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "numeric" }).format(d);
    days.push({ iso, weekday, day });
  }
  return days;
}

function formatSlotTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function hourInBangkok(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(
      new Date(iso)
    )
  );
}

function groupByPeriod(slots: Slot[], t: PublicText): { label: string; slots: Slot[] }[] {
  const groups = [
    { label: t.morning, slots: [] as Slot[] },
    { label: t.afternoon, slots: [] as Slot[] },
    { label: t.evening, slots: [] as Slot[] },
  ];
  for (const slot of slots) {
    const hour = hourInBangkok(slot.startTime);
    if (hour < 12) groups[0].slots.push(slot);
    else if (hour < 17) groups[1].slots.push(slot);
    else groups[2].slots.push(slot);
  }
  return groups.filter((g) => g.slots.length > 0);
}

export function ManageBookingClient({
  bookingId,
  serviceName,
  startTimeLabel,
  amountLabel,
  canReschedule,
  canCancel,
  rescheduleCutoffHours,
  cancelCutoffHours,
  isClassBooking,
  locale,
}: {
  bookingId: string;
  serviceId: string;
  serviceName: string;
  startTimeLabel: string;
  amountLabel: string | null;
  canReschedule: boolean;
  canCancel: boolean;
  rescheduleCutoffHours: number;
  cancelCutoffHours: number;
  isClassBooking: boolean;
  locale: Locale;
}) {
  const t = publicText[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const days = useMemo(() => nextDays(7, locale), [locale]);
  const today = days[0].iso;

  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [pendingSlot, setPendingSlot] = useState<Slot | null>(null);

  const periods = useMemo(() => groupByPeriod(slots, t), [slots, t]);

  function openReschedule() {
    setShowReschedule(true);
    setError(null);
    startTransition(async () => {
      const next = await fetchRescheduleSlots(bookingId, today);
      setSlots(next);
    });
  }

  function selectDate(dateISO: string) {
    setSelectedDate(dateISO);
    startTransition(async () => {
      const next = await fetchRescheduleSlots(bookingId, dateISO);
      setSlots(next);
    });
  }

  function confirmReschedule() {
    if (!pendingSlot) return;
    const slot = pendingSlot;
    setError(null);
    startTransition(async () => {
      const result = await rescheduleBooking(bookingId, slot.startTime, slot.endTime);
      setPendingSlot(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMovedTo(formatSlotTime(slot.startTime, locale));
      router.refresh();
      setShowReschedule(false);
    });
  }

  function confirmCancel() {
    setError(null);
    setConfirmingCancel(false);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCancelled(true);
      router.refresh();
    });
  }

  if (cancelled) {
    return <p className="mt-4 text-sm text-ink-secondary">{t.cancelledDone}</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
      {movedTo && <div className="text-sm text-[#1b8a5a]">{tMovedTo(locale, movedTo)}</div>}

      {!showReschedule && (
        <div className="flex gap-2">
          {canReschedule ? (
            <button
              onClick={openReschedule}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-page"
            >
              {t.reschedule}
            </button>
          ) : (
            <div className="flex-1 text-xs text-ink-muted">
              {isClassBooking
                ? t.classNoReschedule
                : tRescheduleCutoff(locale, rescheduleCutoffHours)}
            </div>
          )}
        </div>
      )}

      {showReschedule && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const selected = d.iso === selectedDate;
              return (
                <button
                  key={d.iso}
                  onClick={() => selectDate(d.iso)}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-2 hover:bg-page"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    {d.weekday}
                  </span>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      selected ? "bg-sunburst font-medium text-ink" : "text-ink"
                    }`}
                  >
                    {d.day}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            {slots.length === 0 ? (
              <div className="text-sm text-ink-muted">{t.noTimesThisDay}</div>
            ) : (
              <div className="flex max-h-72 flex-col gap-4 overflow-y-auto pr-1">
                {periods.map((period) => (
                  <div key={period.label}>
                    <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      {period.label}
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      {period.slots.map((s) => (
                        <button
                          key={s.startTime}
                          disabled={isPending}
                          onClick={() => setPendingSlot(s)}
                          className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm text-ink-secondary transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50"
                        >
                          <span>{formatSlotTime(s.startTime, locale)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {canCancel ? (
        <button
          onClick={() => setConfirmingCancel(true)}
          disabled={isPending}
          className="rounded-xl border border-border py-2.5 text-sm text-[#d03b3b] disabled:opacity-50"
        >
          {t.cancelBooking}
        </button>
      ) : (
        <div className="text-xs text-ink-muted">
          {tCancelCutoff(locale, cancelCutoffHours)}
        </div>
      )}

      {pendingSlot && (
        <ConfirmOverlay
          title={t.moveTitle}
          onCancel={() => setPendingSlot(null)}
          onConfirm={confirmReschedule}
          confirmLabel={isPending ? t.moving : t.moveBooking}
          confirmDisabled={isPending}
          cancelLabel={t.keepAsIs}
        >
          <SummaryBlock serviceName={serviceName} timeLabel={formatSlotTime(pendingSlot.startTime, locale)} amountLabel={amountLabel} locale={locale} />
          <p className="mt-3">{t.moveDesc}</p>
        </ConfirmOverlay>
      )}

      {confirmingCancel && (
        <ConfirmOverlay
          title={t.cancelTitle}
          onCancel={() => setConfirmingCancel(false)}
          onConfirm={confirmCancel}
          confirmLabel={isPending ? t.cancelling : t.cancelBooking}
          confirmDisabled={isPending}
          cancelLabel={t.keepAsIs}
          danger
        >
          <SummaryBlock serviceName={serviceName} timeLabel={startTimeLabel} amountLabel={amountLabel} locale={locale} />
          <p className="mt-3">
            {t.cancelFreesSlot}
            {amountLabel && (
              <>
                {" "}
                {t.cancelNoRefundBefore} <strong>{t.cancelNoRefundNot}</strong> {t.cancelNoRefundAfter}
              </>
            )}
          </p>
        </ConfirmOverlay>
      )}
    </div>
  );
}

function SummaryBlock({
  serviceName,
  timeLabel,
  amountLabel,
  locale,
}: {
  serviceName: string;
  timeLabel: string;
  amountLabel: string | null;
  locale: Locale;
}) {
  return (
    <div className="rounded-lg bg-page px-3 py-2 text-sm text-ink">
      <div>{serviceName}</div>
      <div className="text-ink-secondary">{timeLabel}</div>
      <div className="text-ink-secondary">{amountLabel ? tPaidAmount(locale, amountLabel) : publicText[locale].freeBooking}</div>
    </div>
  );
}

// Real-consequence confirmation for the two customer-facing mutations here
// (reschedule, cancel) — same "intent -> confirmation -> outcome" shape as
// the owner dashboard's ConfirmSubmitButton, just built for a useTransition
// client flow instead of a server-action form.
function ConfirmOverlay({
  title,
  children,
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  cancelLabel,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  cancelLabel: string;
  danger?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] text-ink">{title}</div>
        <div className="mt-3 text-ink-secondary">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-page"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              danger ? "bg-[#d03b3b] text-white" : "bg-sunburst text-ink"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
