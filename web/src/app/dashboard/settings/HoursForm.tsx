"use client";

import { useActionState, useState } from "react";
import { updateBusinessHours, type ActionResult } from "./actions";

type DayHours = { day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null };

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toHHMM(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export function HoursForm({ hours }: { hours: DayHours[] }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateBusinessHours,
    null
  );
  const [closedDays, setClosedDays] = useState<Record<number, boolean>>(
    Object.fromEntries(hours.map((h) => [h.day_of_week, h.is_closed]))
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
      <div className="text-sm font-medium text-ink-secondary">Opening hours</div>
      <div className="flex flex-col gap-2">
        {hours.map((h) => (
          <div key={h.day_of_week} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="w-24 shrink-0">{DAY_LABELS[h.day_of_week]}</span>
            <label className="flex items-center gap-1.5 text-ink-secondary">
              <input
                type="checkbox"
                name={`closed_${h.day_of_week}`}
                defaultChecked={h.is_closed}
                onChange={(e) =>
                  setClosedDays((v) => ({ ...v, [h.day_of_week]: e.target.checked }))
                }
              />
              Closed
            </label>
            {!closedDays[h.day_of_week] && (
              <>
                <input
                  type="time"
                  name={`open_${h.day_of_week}`}
                  defaultValue={toHHMM(h.open_time) || "09:00"}
                  className="rounded-lg border border-border px-2 py-1.5 text-sm"
                />
                <span className="text-ink-muted">to</span>
                <input
                  type="time"
                  name={`close_${h.day_of_week}`}
                  defaultValue={toHHMM(h.close_time) || "19:00"}
                  className="rounded-lg border border-border px-2 py-1.5 text-sm"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save hours"}
      </button>
    </form>
  );
}
