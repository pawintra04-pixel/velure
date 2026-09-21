"use client";

import { useActionState } from "react";
import { updateBusinessProfile, type ActionResult } from "./actions";

type Business = {
  name: string;
  business_type: string | null;
  logo_url: string | null;
  description: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
};

const BUSINESS_TYPES = ["Fitness", "Spa", "Clinic", "Salon", "Other"];

export function ProfileForm({ business }: { business: Business }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateBusinessProfile,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <label className="text-sm font-medium text-ink-secondary">
        Business name
        <input
          name="name"
          defaultValue={business.name}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
        />
      </label>

      <label className="text-sm font-medium text-ink-secondary">
        Business type
        <select
          name="businessType"
          defaultValue={business.business_type ?? ""}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
        >
          <option value="">Not set</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-ink-secondary">
        Logo URL
        <input
          name="logoUrl"
          type="url"
          defaultValue={business.logo_url ?? ""}
          placeholder="https://..."
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
        />
      </label>

      <label className="text-sm font-medium text-ink-secondary">
        Description
        <textarea
          name="description"
          rows={3}
          defaultValue={business.description ?? ""}
          placeholder="Shown to customers on your public booking page."
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
        />
      </label>

      <label className="text-sm font-medium text-ink-secondary">
        Address
        <input
          name="address"
          defaultValue={business.address ?? ""}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink-secondary">
          Contact phone
          <input
            name="contactPhone"
            defaultValue={business.contact_phone ?? ""}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-sm font-medium text-ink-secondary">
          Contact email
          <input
            name="contactEmail"
            type="email"
            defaultValue={business.contact_email ?? ""}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
          />
        </label>
      </div>

      {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
