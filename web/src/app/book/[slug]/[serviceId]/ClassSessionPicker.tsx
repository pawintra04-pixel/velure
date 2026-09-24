"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reserveClassSeat } from "../../actions";
import type { Locale } from "@/lib/i18n";
import { publicText, intlLocale, tSpotsLeft } from "@/lib/i18n-public";

type Session = {
  id: string;
  start_time: string;
  capacity: number;
  seats_booked: number;
  staff_name: string;
};

function formatSessionTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ClassSessionPicker({
  slug,
  businessId,
  sessions,
  source,
  locale,
}: {
  slug: string;
  businessId: string;
  sessions: Session[];
  source: string | null;
  locale: Locale;
}) {
  const t = publicText[locale];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reserve(session: Session) {
    setError(null);
    setReservingId(session.id);
    startTransition(async () => {
      const result = await reserveClassSeat({ businessId, classSessionId: session.id, source });
      if (!result.ok) {
        setReservingId(null);
        setError(
          result.reason === "class_full"
            ? t.classFull
            : result.reason === "too_many_holds"
              ? t.tooManyHolds
              : t.genericError
        );
        return;
      }
      router.push(`/book/${slug}/details/${result.bookingId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <div className="text-sm text-ink-secondary">{t.upcomingSessions}</div>
      {sessions.length === 0 && (
        <div className="text-sm text-ink-muted">{t.noUpcomingSessions}</div>
      )}
      {sessions.map((s) => {
        const seatsLeft = s.capacity - s.seats_booked;
        const isFull = seatsLeft <= 0;
        return (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-5 py-4"
          >
            <div>
              <div className="text-sm font-medium">{formatSessionTime(s.start_time, locale)}</div>
              <div className="mt-1 text-xs text-ink-muted">
                {s.staff_name} · {isFull ? t.full : tSpotsLeft(locale, seatsLeft, s.capacity)}
              </div>
            </div>
            <button
              onClick={() => reserve(s)}
              disabled={isFull || isPending}
              className="rounded-xl border border-border px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {reservingId === s.id ? t.reserving : isFull ? t.full : t.reserveSeat}
            </button>
          </div>
        );
      })}
      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
    </div>
  );
}
