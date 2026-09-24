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
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { effectiveDepositAmount } from "@/lib/deposit";
import { servicesText, tClassSeats, tMinBuffer, tDepositPercentLabel, type Locale } from "@/lib/i18n";

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
  deposit_percent: number | null;
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
  const [paymentMode, setPaymentMode] = useState(service.payment_mode);
  const [depositKind, setDepositKind] = useState<"fixed" | "percent">(
    service.deposit_percent != null ? "percent" : "fixed"
  );
  // A successful save revalidates and brings fresh server props, but this
  // component stays mounted (same key) across that re-render, so the local
  // dropdown/radio state would otherwise keep showing whatever the owner
  // had selected before saving instead of what was actually just saved —
  // adjusted during render against the previous prop values, same pattern
  // Sidebar.tsx and AddServiceForm.tsx already use for this exact case.
  const [prevService, setPrevService] = useState(service);
  if (prevService.payment_mode !== service.payment_mode || prevService.deposit_percent !== service.deposit_percent) {
    setPrevService(service);
    setPaymentMode(service.payment_mode);
    setDepositKind(service.deposit_percent != null ? "percent" : "fixed");
  }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
              {formatBaht(
                service.payment_mode === "deposit"
                  ? effectiveDepositAmount({
                      priceAmount: service.price_amount,
                      depositAmount: service.deposit_amount,
                      depositPercent: service.deposit_percent,
                    })
                  : service.price_amount
              )}
            </div>
            <div className="text-xs text-ink-muted">
              {service.payment_mode === "deposit"
                ? service.deposit_percent != null
                  ? tDepositPercentLabel(locale, service.deposit_percent)
                  : t.deposit
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
            <ConfirmSubmitButton
              action={deleteService}
              hiddenFields={{ serviceId: service.id }}
              label={t.delete}
              pendingLabel={t.deleting}
              confirmTitle={t.deleteServiceTitle}
              confirmDescription={
                <>
                  <strong className="text-ink">{service.name}</strong>
                  <p className="mt-2">{t.deleteServiceDesc}</p>
                </>
              }
              confirmLabel={t.delete}
              cancelLabel={t.goBack}
              danger
              buttonClassName="rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
            />
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
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <label className="text-sm font-medium text-ink-secondary">
                {t.paymentMode}
                <select
                  name="paymentMode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-normal"
                >
                  <option value="full">{t.fullPayment}</option>
                  <option value="deposit">{t.deposit}</option>
                  <option value="free">{t.free}</option>
                </select>
              </label>
              {paymentMode === "deposit" && (
                <>
                  <div className="flex gap-3 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={depositKind === "fixed"}
                        onChange={() => setDepositKind("fixed")}
                      />
                      {t.depositFixed}
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={depositKind === "percent"}
                        onChange={() => setDepositKind("percent")}
                      />
                      {t.depositPercentOption}
                    </label>
                  </div>
                  <input type="hidden" name="depositKind" value={depositKind} />
                  {depositKind === "fixed" ? (
                    <input
                      name="depositBaht"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={service.deposit_amount != null ? service.deposit_amount / 100 : ""}
                      placeholder={t.depositAmountThb}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      name="depositPercent"
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      defaultValue={service.deposit_percent ?? ""}
                      placeholder={t.depositPercentPlaceholder}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                  )}
                </>
              )}
            </div>
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
                  <ConfirmSubmitButton
                    action={deleteCustomField}
                    hiddenFields={{ fieldId: f.id }}
                    label={t.remove}
                    pendingLabel={t.removing}
                    confirmTitle={t.removeFieldTitle}
                    confirmDescription={
                      <>
                        <strong className="text-ink">{f.label}</strong>
                        <p className="mt-2">{t.removeFieldDesc}</p>
                      </>
                    }
                    confirmLabel={t.remove}
                    cancelLabel={t.goBack}
                    danger
                    buttonClassName="text-xs text-ink-muted hover:text-[#d03b3b]"
                  />
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
                  <ConfirmSubmitButton
                    action={deactivatePackage}
                    hiddenFields={{ packageId: p.id }}
                    label={t.remove}
                    pendingLabel={t.removing}
                    confirmTitle={t.removePackageTitle}
                    confirmDescription={
                      <>
                        <strong className="text-ink">{p.name}</strong>
                        <p className="mt-2">{t.removePackageDesc}</p>
                      </>
                    }
                    confirmLabel={t.remove}
                    cancelLabel={t.goBack}
                    danger
                    buttonClassName="text-xs text-ink-muted hover:text-[#d03b3b]"
                  />
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
