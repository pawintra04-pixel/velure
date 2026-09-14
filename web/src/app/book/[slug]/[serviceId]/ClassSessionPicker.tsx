"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reserveClassSeat } from "../../actions";

type Session = {
  id: string;
  start_time: string;
  capacity: number;
  seats_booked: number;
  staff_name: string;
};

function formatSessionTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ClassSessionPicker({
  slug,
  businessId,
  sessions,
}: {
  slug: string;
  businessId: string;
  sessions: Session[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reserve(session: Session) {
    setError(null);
    setReservingId(session.id);
    startTransition(async () => {
      const result = await reserveClassSeat({ businessId, classSessionId: session.id });
      if (!result.ok) {
        setReservingId(null);
        setError(
          result.reason === "class_full"
            ? "That session just filled up — please pick another."
            : "Something went wrong. Please try again."
        );
        return;
      }
      router.push(`/book/${slug}/details/${result.bookingId}`);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      <div className="text-sm text-ink-secondary">Upcoming sessions</div>
      {sessions.length === 0 && (
        <div className="text-sm text-ink-muted">No upcoming sessions scheduled yet.</div>
      )}
      {sessions.map((s) => {
        const seatsLeft = s.capacity - s.seats_booked;
        const isFull = seatsLeft <= 0;
        return (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
          >
            <div>
              <div className="text-sm font-medium">{formatSessionTime(s.start_time)}</div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {s.staff_name} · {isFull ? "Full" : `${seatsLeft} of ${s.capacity} spots left`}
              </div>
            </div>
            <button
              onClick={() => reserve(s)}
              disabled={isFull || isPending}
              className="rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              {reservingId === s.id ? "Reserving..." : isFull ? "Full" : "Reserve a seat"}
            </button>
          </div>
        );
      })}
      {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
    </div>
  );
}
