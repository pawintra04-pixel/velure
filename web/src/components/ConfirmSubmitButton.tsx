"use client";

import { useActionState, useState, type ReactNode } from "react";

export type ConfirmActionResult = { ok: true; message?: string } | { ok: false; error: string };

// Velure product principle: AI assists, humans authorize — intent, then an
// explicit confirmation describing the REAL consequence, then the outcome.
// This same shape applies to any consequential action a human owner or
// customer takes, not just AI-originated ones. One reusable primitive:
// - a plain trigger button (never auto-submits)
// - a confirmation panel with the actual booking details, not "Are you sure?"
// - the real server action, run only after explicit confirmation
// - visible pending/success/error feedback — never click-then-silence
export function ConfirmSubmitButton({
  action,
  hiddenFields,
  label,
  pendingLabel,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  cancelLabel = "Keep as is",
  danger = false,
  buttonClassName,
  requireConfirm = true,
  children,
  formClassName,
}: {
  action: (prev: ConfirmActionResult | null, formData: FormData) => Promise<ConfirmActionResult>;
  hiddenFields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  confirmTitle: string;
  confirmDescription: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  buttonClassName: string;
  /** Set false for non-destructive actions (e.g. saving a note) that need feedback but not a confirmation step. */
  requireConfirm?: boolean;
  /** Extra visible form fields (inputs, checkboxes) rendered before the trigger button, inside the same form. */
  children?: ReactNode;
  formClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ConfirmActionResult | null, FormData>(action, null);

  // Close the dialog once the action actually resolves (success or error)
  // — adjusted during render against the previous `state` reference, not in
  // an effect (same pattern Sidebar.tsx uses), so the dialog doesn't
  // silently reappear once `pending` flips back to false.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    setOpen(false);
  }

  return (
    // min-w-0: this can render as one item inside a `justify-between` flex
    // row alongside another action button (e.g. Team's Hours/Delete pair).
    // Without it, a flex item defaults to min-width:auto and won't shrink
    // below its unwrapped content width — so once the error/success line
    // below the trigger renders a full sentence, this item refuses to
    // shrink and forces the sibling (often a `min-w-0` name/label column)
    // to collapse instead of letting this message wrap in place.
    <div className="min-w-0">
      <form action={formAction} className={formClassName}>
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children}
        <button
          type={requireConfirm ? "button" : "submit"}
          onClick={requireConfirm ? () => setOpen(true) : undefined}
          disabled={pending}
          className={`${buttonClassName} disabled:opacity-50`}
        >
          {pending ? (pendingLabel ?? "Working…") : label}
        </button>

        {open && !pending && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-surface p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[15px] text-ink">{confirmTitle}</div>
              <div className="mt-3 text-sm leading-relaxed text-ink-secondary">{confirmDescription}</div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm hover:bg-page"
                >
                  {cancelLabel}
                </button>
                <button
                  type="submit"
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    danger ? "bg-[#d03b3b] text-white" : "bg-sunburst text-ink"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {state && !state.ok && <div className="mt-1 text-xs text-[#d03b3b]">{state.error}</div>}
      {state && state.ok && state.message && (
        <div className="mt-1 text-xs text-[#1b8a5a]">✓ {state.message}</div>
      )}
    </div>
  );
}
