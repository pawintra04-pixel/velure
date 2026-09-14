"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchRescheduleSlots, rescheduleBooking, cancelBooking } from "./actions";
import type { Slot } from "@/lib/availability";

function nextDays(n: number): { iso: string; weekday: string; day: string }[] {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", weekday: "short" })
      .format(d)
      .slice(0, 2);
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", day: "numeric" }).format(d);
    days.push({ iso, weekday, day });
  }
  return days;
}

function formatSlotTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
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

function groupByPeriod(slots: Slot[]): { label: string; slots: Slot[] }[] {
  const groups = [
    { label: "Morning", slots: [] as Slot[] },
    { label: "Afternoon", slots: [] as Slot[] },
    { label: "Evening", slots: [] as Slot[] },
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
  canReschedule,
  canCancel,
  rescheduleCutoffHours,
  cancelCutoffHours,
  isClassBooking,
}: {
  bookingId: string;
  serviceId: string;
  canReschedule: boolean;
  canCancel: boolean;
  rescheduleCutoffHours: number;
  cancelCutoffHours: number;
  isClassBooking: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const days = useMemo(() => nextDays(7), []);
  const today = days[0].iso;

  const [showReschedule, setShowReschedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const periods = useMemo(() => groupByPeriod(slots), [slots]);

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

  function pickSlot(slot: Slot) {
    setError(null);
    startTransition(async () => {
      const result = await rescheduleBooking(bookingId, slot.startTime, slot.endTime);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      setShowReschedule(false);
    });
  }

  function handleCancel() {
    setError(null);
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
    return <p className="mt-4 text-sm text-ink-secondary">Your booking has been cancelled.</p>;
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}

      {!showReschedule && (
        <div className="flex gap-2">
          {canReschedule ? (
            <button
              onClick={openReschedule}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-page"
            >
              Reschedule
            </button>
          ) : (
            <div className="flex-1 text-xs text-ink-muted">
              {isClassBooking
                ? "Class bookings can't be rescheduled — cancel and book a different session instead."
                : `Reschedules must be made at least ${rescheduleCutoffHours}h in advance.`}
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
                      selected ? "bg-accent font-medium text-accent-ink" : "text-ink"
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
              <div className="text-sm text-ink-muted">No available times on this day</div>
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
                          onClick={() => pickSlot(s)}
                          className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm text-ink-secondary transition-colors hover:border-accent hover:text-ink disabled:opacity-50"
                        >
                          <span>{formatSlotTime(s.startTime)}</span>
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
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-xl border border-border py-2.5 text-sm text-[#d03b3b] disabled:opacity-50"
        >
          Cancel booking
        </button>
      ) : (
        <div className="text-xs text-ink-muted">
          Cancellations must be made at least {cancelCutoffHours}h in advance.
        </div>
      )}
    </div>
  );
}
