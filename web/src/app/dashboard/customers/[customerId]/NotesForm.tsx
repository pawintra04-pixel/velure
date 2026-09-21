"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { updateCustomerNotes } from "../actions";

// Notes are informational only (never read by booking/payment logic), so
// saving just needs feedback, not a confirmation step.
export function NotesForm({ customerId, notes }: { customerId: string; notes: string }) {
  return (
    <ConfirmSubmitButton
      action={updateCustomerNotes}
      hiddenFields={{ customerId }}
      label="Save"
      requireConfirm={false}
      confirmTitle=""
      confirmDescription={null}
      confirmLabel="Save"
      buttonClassName="self-start rounded-full border border-border px-4 py-1.5 text-xs hover:bg-page"
      formClassName="flex flex-col gap-2"
    >
      <textarea
        name="notes"
        defaultValue={notes}
        rows={3}
        placeholder="e.g. Prefers afternoon slots, allergic to lavender oil"
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
    </ConfirmSubmitButton>
  );
}
