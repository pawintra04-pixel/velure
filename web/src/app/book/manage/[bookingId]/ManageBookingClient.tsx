"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchRescheduleSlots, rescheduleBooking, cancelBooking } from "./actions";
import type { Slot } from "@/lib/availability";

function nextDays(n: number): { iso: string; label: string }[] {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
    days.push({ iso, label });
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
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.iso}
                onClick={() => selectDate(d.iso)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  d.iso === selectedDate ? "bg-sidebar text-white" : "border border-border text-ink-secondary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {slots.length === 0 ? (
              <div className="text-sm text-ink-muted">No available times on this day</div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {slots.map((s) => (
                  <button
                    key={s.startTime}
                    disabled={isPending}
                    onClick={() => pickSlot(s)}
                    className="rounded-xl border border-border px-3 py-2.5 text-sm text-ink-secondary disabled:opacity-50"
                  >
                    {formatSlotTime(s.startTime)}
                  </button>
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
