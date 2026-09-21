"use client";

import { useActionState, useState } from "react";
import {
  updateServiceDetails,
  addCustomField,
  deleteCustomField,
  deleteService,
  type ActionResult,
} from "./actions";
import { formatBaht } from "@/lib/money";

export type CustomField = { id: string; label: string; importance: "optional" | "important" | "required" };

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  price_amount: number;
  payment_mode: string;
  deposit_amount: number | null;
  description: string | null;
  image_url: string | null;
  capacity: number | null;
  customFields: CustomField[];
};

const IMPORTANCE_LABEL: Record<CustomField["importance"], string> = {
  optional: "Optional",
  important: "Important",
  required: "Required to submit",
};

export function ServiceCard({ service }: { service: Service }) {
  const [expanded, setExpanded] = useState(false);
  const [detailsState, detailsAction, detailsPending] = useActionState<ActionResult | null, FormData>(
    updateServiceDetails,
    null
  );
  const [fieldState, fieldAction, fieldPending] = useActionState<ActionResult | null, FormData>(
    addCustomField,
    null
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {service.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- owner-pasted external URL, not a static/optimizable asset
            <img
              src={service.image_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{service.name}</span>
              {service.capacity && (
                <span className="rounded-full bg-[#eaf1fb] px-2 py-0.5 text-xs text-[#3462ad]">
                  Class · {service.capacity} seats
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {service.duration_minutes} min
              {service.buffer_minutes > 0 && ` + ${service.buffer_minutes} min buffer`}
            </div>
            {service.description && (
              <div className="mt-1 text-sm text-ink-secondary sm:max-w-md">{service.description}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
          <div>
            <div className="font-semibold">
              {formatBaht(service.payment_mode === "deposit" ? service.deposit_amount ?? 0 : service.price_amount)}
            </div>
            <div className="text-xs text-ink-muted">
              {service.payment_mode === "deposit"
                ? "Deposit"
                : service.payment_mode === "free"
                  ? "Free"
                  : "Full payment"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
            >
              {expanded ? "Close" : "Edit"}
            </button>
            <form action={deleteService}>
              <input type="hidden" name="serviceId" value={service.id} />
              <button
                type="submit"
                className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 flex flex-col gap-6 border-t border-border pt-5">
          <form action={detailsAction} className="flex flex-col gap-3">
            <input type="hidden" name="serviceId" value={service.id} />
            <label className="text-sm font-medium text-ink-secondary">
              Description
              <textarea
                name="description"
                rows={3}
                defaultValue={service.description ?? ""}
                placeholder="What customers see on your booking page — what's included, what to expect, anything to prepare."
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-medium text-ink-secondary">
              Photo URL
              <input
                name="imageUrl"
                type="url"
                defaultValue={service.image_url ?? ""}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-medium text-ink-secondary">
              Capacity (seats)
              <input
                name="capacity"
                type="number"
                min={2}
                step={1}
                defaultValue={service.capacity ?? ""}
                placeholder="Leave blank for a regular 1:1 service"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-ink-muted">
                Only affects sessions scheduled after you save — sessions already on the
                calendar keep their original capacity.
              </span>
            </label>
            {detailsState && !detailsState.ok && (
              <div className="text-sm text-[#d03b3b]">{detailsState.error}</div>
            )}
            <button
              type="submit"
              disabled={detailsPending}
              className="self-start rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
            >
              {detailsPending ? "Saving..." : "Save details"}
            </button>
          </form>

          <div>
            <div className="text-sm font-medium text-ink-secondary">
              Booking form questions
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Extra questions customers answer when booking this service. Mark ones that
              must be filled in to submit as required.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {service.customFields.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{f.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        f.importance === "required"
                          ? "bg-[#fbeef2] text-[#b34a6b]"
                          : f.importance === "important"
                            ? "bg-[#fdf3e6] text-[#a8681c]"
                            : "bg-page text-ink-muted"
                      }`}
                    >
                      {IMPORTANCE_LABEL[f.importance]}
                    </span>
                  </div>
                  <form action={deleteCustomField}>
                    <input type="hidden" name="fieldId" value={f.id} />
                    <button type="submit" className="text-xs text-ink-muted hover:text-ink-secondary">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
              {service.customFields.length === 0 && (
                <div className="text-sm text-ink-muted">No extra questions yet.</div>
              )}
            </div>

            <form action={fieldAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="serviceId" value={service.id} />
              <input
                name="label"
                placeholder="e.g. Any allergies?"
                className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <select
                name="importance"
                defaultValue="optional"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="optional">Optional</option>
                <option value="important">Important</option>
                <option value="required">Required to submit</option>
              </select>
              <button
                type="submit"
                disabled={fieldPending}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
              >
                Add
              </button>
            </form>
            {fieldState && !fieldState.ok && (
              <div className="mt-2 text-sm text-[#d03b3b]">{fieldState.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
