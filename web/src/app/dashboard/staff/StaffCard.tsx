"use client";

import { useActionState, useState } from "react";
import {
  updateStaffHours,
  deleteStaff,
  createStaffBlock,
  deleteStaffBlock,
  type ActionResult,
} from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { teamText, tDeleteStaffTitle, type Locale } from "@/lib/i18n";

type DayHours = {
  day_of_week: number;
  is_off: boolean;
  start_time: string | null;
  end_time: string | null;
  break_start: string | null;
  break_end: string | null;
};

type Block = { id: string; start_time: string; end_time: string; reason: string | null };

export type Staff = {
  id: string;
  name: string;
  service_names: string[];
  hours: DayHours[];
  blocks: Block[];
};

function formatBlockTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function toHHMM(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export function StaffCard({ staff, locale }: { staff: Staff; locale: Locale }) {
  const t = teamText[locale];
  const DAY_LABELS = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
  const [expanded, setExpanded] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateStaffHours,
    null
  );
  const [blockState, blockFormAction, blockPending] = useActionState<ActionResult | null, FormData>(
    createStaffBlock,
    null
  );
  const [offDays, setOffDays] = useState<Record<number, boolean>>(
    Object.fromEntries(staff.hours.map((h) => [h.day_of_week, h.is_off]))
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      {/*
        sm:flex-wrap: the button cluster's flex-shrink:0 sizes it to its
        widest unwrapped line — normally just two short buttons, but the
        Delete trigger can also render a full-sentence error/success line
        beneath itself (see ConfirmSubmitButton). Without wrap, that line's
        width gets forced onto this row and starves the min-w-0 name column
        instead of the button cluster simply dropping to its own full-width
        line where the message can wrap normally.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium">{staff.name}</div>
          <div className="mt-1 text-sm text-ink-muted">
            {staff.service_names.length > 0 ? staff.service_names.join(", ") : t.noServicesAssigned}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          >
            {expanded ? t.close : t.hours}
          </button>
          <ConfirmSubmitButton
            action={deleteStaff}
            hiddenFields={{ staffId: staff.id }}
            label={t.delete}
            pendingLabel={t.deleting}
            confirmTitle={tDeleteStaffTitle(locale, staff.name)}
            confirmDescription={t.deleteStaffDesc}
            confirmLabel={t.delete}
            cancelLabel={t.goBack}
            danger
            buttonClassName="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
          />
        </div>
      </div>

      {expanded && (
        <form action={formAction} className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
          <input type="hidden" name="staffId" value={staff.id} />
          <div className="text-sm font-medium text-ink-secondary">{t.workingHours}</div>
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
                  {t.off}
                </label>
                {!offDays[h.day_of_week] && (
                  <>
                    <input
                      type="time"
                      name={`start_${h.day_of_week}`}
                      defaultValue={toHHMM(h.start_time) || "09:00"}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-muted">{t.to}</span>
                    <input
                      type="time"
                      name={`end_${h.day_of_week}`}
                      defaultValue={toHHMM(h.end_time) || "19:00"}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-muted">{t.break}</span>
                    <input
                      type="time"
                      name={`breakStart_${h.day_of_week}`}
                      defaultValue={toHHMM(h.break_start)}
                      className="rounded-lg border border-border px-2 py-1.5 text-sm"
                    />
                    <span className="text-ink-muted">{t.to}</span>
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
            {pending ? t.saving : t.saveHours}
          </button>
        </form>
      )}

      {expanded && (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
          <div className="text-sm font-medium text-ink-secondary">{t.blockedTime}</div>
          <p className="text-xs text-ink-muted">
            {t.blockedTimeHint}
          </p>

          <div className="flex flex-col gap-2">
            {staff.blocks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {formatBlockTime(b.start_time, locale)} – {formatBlockTime(b.end_time, locale)}
                  {b.reason && <span className="text-ink-muted"> · {b.reason}</span>}
                </span>
                <ConfirmSubmitButton
                  action={deleteStaffBlock}
                  hiddenFields={{ blockId: b.id }}
                  label={t.remove}
                  pendingLabel={t.removing}
                  confirmTitle={t.removeBlockTitle}
                  confirmDescription={
                    <>
                      <strong className="text-ink">
                        {staff.name} · {formatBlockTime(b.start_time, locale)} – {formatBlockTime(b.end_time, locale)}
                      </strong>
                      <p className="mt-2">{t.removeBlockDesc}</p>
                    </>
                  }
                  confirmLabel={t.remove}
                  cancelLabel={t.goBack}
                  danger
                  buttonClassName="text-xs text-ink-muted hover:text-[#d03b3b]"
                />
              </div>
            ))}
            {staff.blocks.length === 0 && (
              <div className="text-sm text-ink-muted">{t.noUpcomingBlocks}</div>
            )}
          </div>

          <form action={blockFormAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="staffId" value={staff.id} />
            <input type="date" name="date" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
            <input type="time" name="start" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
            <span className="text-ink-muted">{t.to}</span>
            <input type="time" name="end" className="rounded-lg border border-border px-2 py-1.5 text-sm" />
            <input
              name="reason"
              placeholder={t.reasonOptional}
              className="min-w-0 flex-1 rounded-lg border border-border px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={blockPending}
              className="rounded-xl border border-border px-3 py-1.5 text-sm font-medium hover:bg-page disabled:opacity-50"
            >
              {t.addBlock}
            </button>
          </form>
          {blockState && !blockState.ok && (
            <div className="text-sm text-[#d03b3b]">{blockState.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
