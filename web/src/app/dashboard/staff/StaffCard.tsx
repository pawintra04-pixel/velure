"use client";

import { useActionState, useState } from "react";
import { updateStaffHours, deleteStaff, type ActionResult } from "./actions";

type DayHours = {
  day_of_week: number;
  is_off: boolean;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
};

export type Staff = { id: string; name: string; service_names: string[]; hours: DayHours[] };

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toHHMM(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export function StaffCard({ staff }: { staff: Staff }) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateStaffHours,
    null
  );
  const [offDays, setOffDays] = useState<Record<number, boolean>>(
    Object.fromEntries(staff.hours.map((h) => [h.day_of_week, h.is_off]))
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium">{staff.name}</div>
          <div className="mt-1 text-sm text-ink-muted">
            {staff.service_names.length > 0 ? staff.service_names.join(", ") : "No services assigned"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          >
            {expanded ? "Close" : "Hours"}
          </button>
          <form action={deleteStaff}>
            <input type="hidden" name="staffId" value={staff.id} />
            <button
              type="submit"
              className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {expanded && (
        <form action={formAction} className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
          <input type="hidden" name="staffId" value={staff.id} />
          <div className="text-sm font-medium text-ink-secondary">Working hours &amp; breaks</div>
          <div className="flex flex-col gap-2">
            {staff.hours.map((h) => (
              <div key={h.day_of_week} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-24 shrink-0">{DAY_LABELS[h.day_of_week]}</span>
                <label className="flex items-center gap-1.5 text-ink-secondary">
                  <input
                    type="checkbox"
                    name={`off_${h.day_of_week}`}
                    defaultChecked={h.is_off}
                    onChange={(e) =>
                      setOffDays((v) => ({ ...v, [h.day_of_week]: e.target.checked }))
                    }
                  />
                  Off
                </label>
                {!offDays[h.day_of_week] && (
                  <>
                    <input
                      type="time"
                      name={`start_${h.day_of_week}`}
                      defaultValue={toHHMM(h.start_time) || "09:00"}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-muted">to</span>
                    <input
                      type="time"
                      name={`end_${h.day_of_week}`}
                      defaultValue={toHHMM(h.end_time) || "19:00"}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-muted">break</span>
                    <input
                      type="time"
                      name={`breakStart_${h.day_of_week}`}
                      defaultValue={toHHMM(h.break_start)}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-muted">to</span>
                    <input
                      type="time"
                      name={`breakEnd_${h.day_of_week}`}
                      defaultValue={toHHMM(h.break_end)}
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
            className="self-start rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save hours"}
          </button>
        </form>
      )}
    </div>
  );
}
