"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { updateCustomerTags } from "../actions";

// One tag per line, not comma-separated — see updateCustomerTags' comment
// for why. Same informational-only, no-confirm-needed shape as NotesForm.
export function TagsForm({ customerId, tags }: { customerId: string; tags: string[] }) {
  return (
    <ConfirmSubmitButton
      action={updateCustomerTags}
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
        name="tags"
        defaultValue={tags.join("\n")}
        rows={3}
        placeholder={"One tag per line, e.g.\nVIP\nPrefers quiet room"}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
    </ConfirmSubmitButton>
  );
}
