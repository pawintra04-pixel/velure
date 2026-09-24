"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchSlots, createQuickHold, joinWaitlist } from "../../actions";
import type { Slot } from "@/lib/availability";
import type { Locale } from "@/lib/i18n";
import { publicText, intlLocale, type PublicText } from "@/lib/i18n-public";

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

// Grouped into periods rather than one flat grid — reads as a proper
// schedule rather than a bank of interchangeable buttons.
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

// Shown in place of the empty-slots message — lets a visitor leave contact
// info against (service, date) instead of just seeing a dead end. No
// payment, no reservation: joining only means "tell me if a spot opens."
function JoinWaitlistForm({
  businessId,
  serviceId,
  targetDate,
  t,
}: {
  businessId: string;
  serviceId: string;
  targetDate: string;
  t: PublicText;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    joinWaitlist({ businessId, serviceId, targetDate, customerName: name, customerPhone: phone, customerEmail: email })
      .then((r) => {
        setPending(false);
        setResult(
          r.ok
            ? { ok: true, message: t.waitlistJoined }
            : { ok: false, message: t.nameAndPhoneRequired }
        );
        if (r.ok) {
          setName("");
          setPhone("");
          setEmail("");
        }
      })
      .catch(() => {
        setPending(false);
        setResult({ ok: false, message: t.genericError });
      });
  }

  if (result?.ok) {
    return <div className="mt-3 text-sm text-ink">{result.message}</div>;
  }

  if (!open) {
    return (
      <div className="mt-3">
        <div className="text-sm text-ink-muted">{t.noTimesThisDay}</div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 rounded-full border border-border px-4 py-2 text-sm text-ink-secondary hover:border-sunburst hover:text-ink"
        >
          {t.notifyMe}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 rounded-xl border border-border p-4">
      <div className="text-sm text-ink">{t.waitlistIntro}</div>
      <input
        type="text"
        required
        placeholder={t.yourName}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
      <input
        type="tel"
        required
        placeholder={t.phoneNumber}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
      <input
        type="email"
        placeholder={t.emailOptional}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-sunburst px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? t.joining : t.joinWaitlist}
      </button>
      {result && !result.ok && <div className="text-sm text-[#d03b3b]">{result.message}</div>}
    </form>
  );
}

export function BookingWizard({
  slug,
  businessId,
  serviceId,
  initialDate,
  initialSlots,
  source,
  locale,
}: {
  slug: string;
  businessId: string;
  serviceId: string;
  initialDate: string;
  initialSlots: Slot[];
  source: string | null;
  locale: Locale;
}) {
  const t = publicText[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const days = useMemo(() => nextDays(7, locale), [locale]);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [slots, setSlots] = useState(initialSlots);
  const [reservingSlot, setReservingSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const periods = useMemo(() => groupByPeriod(slots, t), [slots, t]);

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
        source,
      });

      if (!result.ok) {
        setReservingSlot(null);
        if (result.reason === "slot_taken") {
          setError(t.slotTaken);
          const refreshed = await fetchSlots(businessId, serviceId, selectedDate);
          setSlots(refreshed);
        } else if (result.reason === "too_many_holds") {
          setError(t.tooManyHolds);
        } else {
          setError(t.genericError);
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
                  selected ? "bg-sunburst font-medium text-ink" : "text-ink"
                }`}
              >
                {d.day}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="text-sm text-ink-secondary">{t.availableTimes}</div>
        {slots.length === 0 ? (
          <JoinWaitlistForm businessId={businessId} serviceId={serviceId} targetDate={selectedDate} t={t} />
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
                          ? "border-sunburst bg-sunburst/10 font-medium"
                          : "border-border text-ink-secondary hover:border-sunburst hover:text-ink"
                      }`}
                    >
                      <span>{formatSlotTime(s.startTime, locale)}</span>
                      <span className="text-xs text-ink-muted">
                        {reservingSlot === s.startTime ? t.reserving : t.reserveInstantly}
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
