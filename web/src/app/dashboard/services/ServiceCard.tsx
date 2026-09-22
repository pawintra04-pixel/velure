"use client";

import { useActionState, useState } from "react";
import {
  updateServiceDetails,
  addCustomField,
  deleteCustomField,
  deleteService,
  addPackage,
  deactivatePackage,
  type ActionResult,
} from "./actions";
import { formatBaht } from "@/lib/money";
import { servicesText, tClassSeats, tMinBuffer, type Locale } from "@/lib/i18n";

export type CustomField = { id: string; label: string; importance: "optional" | "important" | "required" };
export type PackageDef = {
  id: string;
  name: string;
  sessionCount: number;
  priceAmount: number;
  validityDays: number | null;
};

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
  packages: PackageDef[];
};

export function ServiceCard({ service, locale }: { service: Service; locale: Locale }) {
  const t = servicesText[locale];
  const IMPORTANCE_LABEL: Record<CustomField["importance"], string> = {
    optional: t.optional,
    important: t.important,
    required: t.requiredToSubmit,
  };
  const [expanded, setExpanded] = useState(false);
  const [detailsState, detailsAction, detailsPending] = useActionState<ActionResult | null, FormData>(
    updateServiceDetails,
    null
  );
  const [fieldState, fieldAction, fieldPending] = useActionState<ActionResult | null, FormData>(
    addCustomField,
    null
  );
  const [packageState, packageAction, packagePending] = useActionState<ActionResult | null, FormData>(
    addPackage,
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
                  {tClassSeats(locale, service.capacity)}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              {service.duration_minutes} {t.minSuffix}
              {service.buffer_minutes > 0 && tMinBuffer(locale, service.buffer_minutes)}
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
                ? t.deposit
                : service.payment_mode === "free"
                  ? t.free
                  : t.fullPayment}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
            >
              {expanded ? t.close : t.edit}
            </button>
            <form action={deleteService}>
              <input type="hidden" name="serviceId" value={service.id} />
              <button
                type="submit"
                className="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
              >
                {t.delete}
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
              {t.description_}
              <textarea
                name="description"
                rows={3}
                defaultValue={service.description ?? ""}
                placeholder={t.descriptionPlaceholder}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-medium text-ink-secondary">
              {t.photoUrl}
              <input
                name="imageUrl"
                type="url"
                defaultValue={service.image_url ?? ""}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-sm font-medium text-ink-secondary">
              {t.capacitySeats}
              <input
                name="capacity"
                type="number"
                min={2}
                step={1}
                defaultValue={service.capacity ?? ""}
                placeholder={t.capacityEditPlaceholder}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-ink-muted">
                {t.capacityHint}
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
              {detailsPending ? t.saving : t.saveDetails}
            </button>
          </form>

          <div>
            <div className="text-sm font-medium text-ink-secondary">
              {t.bookingFormQuestions}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {t.bookingFormHint}
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
                      {t.remove}
                    </button>
                  </form>
                </div>
              ))}
              {service.customFields.length === 0 && (
                <div className="text-sm text-ink-muted">{t.noExtraQuestionsYet}</div>
              )}
            </div>

            <form action={fieldAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="serviceId" value={service.id} />
              <input
                name="label"
                placeholder={t.fieldPlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <select
                name="importance"
                defaultValue="optional"
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="optional">{t.optional}</option>
                <option value="important">{t.important}</option>
                <option value="required">{t.requiredToSubmit}</option>
              </select>
              <button
                type="submit"
                disabled={fieldPending}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
              >
                {t.add}
              </button>
            </form>
            {fieldState && !fieldState.ok && (
              <div className="mt-2 text-sm text-[#d03b3b]">{fieldState.error}</div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-ink-secondary">{t.packages}</div>
            <p className="mt-1 text-xs text-ink-muted">{t.packagesHint}</p>

            <div className="mt-3 flex flex-col gap-2">
              {service.packages.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{p.name}</span>{" "}
                    <span className="text-ink-muted">
                      · {p.sessionCount} {t.sessionsSuffix} · {formatBaht(p.priceAmount)}
                      {p.validityDays && ` · ${p.validityDays} ${t.daysSuffix}`}
                    </span>
                  </div>
                  <form action={deactivatePackage}>
                    <input type="hidden" name="packageId" value={p.id} />
                    <button type="submit" className="text-xs text-ink-muted hover:text-ink-secondary">
                      {t.remove}
                    </button>
                  </form>
                </div>
              ))}
              {service.packages.length === 0 && (
                <div className="text-sm text-ink-muted">{t.noPackagesYet}</div>
              )}
            </div>

            <form action={packageAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="serviceId" value={service.id} />
              <input
                name="name"
                placeholder={t.packageNamePlaceholder}
                className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                name="sessionCount"
                type="number"
                min={2}
                step={1}
                placeholder={t.sessionsSuffix}
                className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                name="priceBaht"
                type="number"
                min={0}
                step="0.01"
                placeholder={t.priceBaht}
                className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <input
                name="validityDays"
                type="number"
                min={1}
                step={1}
                placeholder={t.validityDaysPlaceholder}
                className="w-32 rounded-lg border border-border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={packagePending}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-page disabled:opacity-50"
              >
                {t.add}
              </button>
            </form>
            {packageState && !packageState.ok && (
              <div className="mt-2 text-sm text-[#d03b3b]">{packageState.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
