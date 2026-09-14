"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchSlots, createQuickHold } from "../../actions";
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

      <div>
        <div className="text-sm text-ink-secondary">Select a time to reserve it instantly</div>
        {slots.length === 0 ? (
          <div className="mt-3 text-sm text-ink-muted">No available times on this day</div>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.startTime}
                onClick={() => reserve(s)}
                disabled={isPending}
                className={`rounded-xl border px-3 py-2 text-sm disabled:opacity-50 ${
                  reservingSlot === s.startTime
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-border text-ink-secondary"
                }`}
              >
                {reservingSlot === s.startTime ? "Reserving..." : formatSlotTime(s.startTime)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
    </div>
  );
}
