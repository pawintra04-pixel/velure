"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchSlots, createHold } from "../actions";
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
  businessId,
  serviceId,
  initialDate,
  initialSlots,
}: {
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
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function selectDate(dateISO: string) {
    setSelectedDate(dateISO);
    setSelectedSlot(null);
    setError(null);
    startTransition(async () => {
      const next = await fetchSlots(businessId, serviceId, dateISO);
      setSlots(next);
    });
  }

  function submit() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await createHold({
        businessId,
        serviceId,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
      });

      if (!result.ok) {
        if (result.reason === "slot_taken") {
          setError("That time slot was just taken — please choose another.");
          const refreshed = await fetchSlots(businessId, serviceId, selectedDate);
          setSlots(refreshed);
          setSelectedSlot(null);
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      router.push(
        result.needsPayment ? `/book/pay/${result.bookingId}` : `/book/confirmed/${result.bookingId}`
      );
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d.iso}
            onClick={() => selectDate(d.iso)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              d.iso === selectedDate ? "bg-ink text-white" : "border border-border text-ink-secondary"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div>
        <div className="text-sm text-ink-secondary">Select a time</div>
        {slots.length === 0 ? (
          <div className="mt-3 text-sm text-ink-muted">No available times on this day</div>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {slots.map((s) => (
              <button
                key={s.startTime}
                onClick={() => setSelectedSlot(s)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  selectedSlot?.startTime === s.startTime
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-border text-ink-secondary"
                }`}
              >
                {formatSlotTime(s.startTime)}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
          <div className="text-sm text-ink-secondary">Your details</div>
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
          <button
            onClick={submit}
            disabled={isPending || !name.trim() || !phone.trim() || !email.trim()}
            className="rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {isPending ? "Processing..." : "Confirm booking"}
          </button>
        </div>
      )}
    </div>
  );
}
