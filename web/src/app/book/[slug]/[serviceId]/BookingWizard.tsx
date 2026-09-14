"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchSlots, createQuickHold } from "../../actions";
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

// Grouped into periods rather than one flat grid — reads as a proper
// schedule rather than a bank of interchangeable buttons.
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

export function BookingWizard({
  slug,
  businessId,
  serviceId,
  initialDate,
  initialSlots,
}: {
  slug: string;
  businessId: string;
  serviceId: string;
  initialDate: string;
  initialSlots: Slot[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const days = useMemo(() => nextDays(7), []);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [slots, setSlots] = useState(initialSlots);
  const [reservingSlot, setReservingSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const periods = useMemo(() => groupByPeriod(slots), [slots]);

  function selectDate(dateISO: string) {
    setSelectedDate(dateISO);
    setError(null);
    startTransition(async () => {
      const next = await fetchSlots(businessId, serviceId, dateISO);
      setSlots(next);
    });
  }

  // Quick booking: picking a time reserves it immediately (no form first) —
  // contact details are collected on the next page, after the slot is
  // already locked in. The DB's overlap EXCLUDE constraint is the actual
  // guard either way; this is purely about not putting a form between the
  // customer and a committed time slot.
  function reserve(slot: Slot) {
    setError(null);
    setReservingSlot(slot.startTime);
    startTransition(async () => {
      const result = await createQuickHold({
        businessId,
        serviceId,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });

      if (!result.ok) {
        setReservingSlot(null);
        if (result.reason === "slot_taken") {
          setError("That time slot was just taken — please choose another.");
          const refreshed = await fetchSlots(businessId, serviceId, selectedDate);
          setSlots(refreshed);
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      router.push(`/book/${slug}/details/${result.bookingId}`);
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
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

      <div>
        <div className="text-sm text-ink-secondary">Available times</div>
        {slots.length === 0 ? (
          <div className="mt-3 text-sm text-ink-muted">No available times on this day</div>
        ) : (
          <div className="mt-3 flex max-h-96 flex-col gap-5 overflow-y-auto pr-1">
            {periods.map((period) => (
              <div key={period.label}>
                <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {period.label}
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {period.slots.map((s) => (
                    <button
                      key={s.startTime}
                      onClick={() => reserve(s)}
                      disabled={isPending}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition-colors disabled:opacity-50 ${
                        reservingSlot === s.startTime
                          ? "border-accent bg-accent/10 font-medium"
                          : "border-border text-ink-secondary hover:border-accent hover:text-ink"
                      }`}
                    >
                      <span>{formatSlotTime(s.startTime)}</span>
                      <span className="text-xs text-ink-muted">
                        {reservingSlot === s.startTime ? "Reserving..." : "Reserve instantly"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
    </div>
  );
}
