"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { updateCustomerTags } from "../actions";
import { customersText, type Locale } from "@/lib/i18n";

// One tag per line, not comma-separated — see updateCustomerTags' comment
// for why. Same informational-only, no-confirm-needed shape as NotesForm.
export function TagsForm({ customerId, tags, locale }: { customerId: string; tags: string[]; locale: Locale }) {
  const t = customersText[locale];
  return (
    <ConfirmSubmitButton
      action={updateCustomerTags}
      hiddenFields={{ customerId }}
      label={t.save}
      requireConfirm={false}
      confirmTitle=""
      confirmDescription={null}
      confirmLabel={t.save}
      buttonClassName="self-start rounded-full border border-border px-4 py-1.5 text-xs hover:bg-page"
      formClassName="flex flex-col gap-2"
    >
      <textarea
        name="tags"
        defaultValue={tags.join("\n")}
        rows={3}
        placeholder={t.tagsPlaceholder}
        className="rounded-lg border border-border px-3 py-2 text-sm"
      />
    </ConfirmSubmitButton>
  );
}
