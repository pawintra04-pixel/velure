"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeBookingDetails } from "../../../actions";

type CustomField = { id: string; label: string; importance: "optional" | "important" | "required" };

type PaymentMethod = "promptpay" | "card" | "cash";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  promptpay: "PromptPay",
  card: "Card",
  cash: "Cash (pay in person)",
};

export function DetailsForm({
  businessId,
  bookingId,
  requiresPayment,
  availableMethods,
  customFields,
}: {
  businessId: string;
  bookingId: string;
  requiresPayment: boolean;
  availableMethods: PaymentMethod[];
  customFields: CustomField[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(availableMethods[0] ?? "promptpay");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const missingRequiredField = customFields.some(
    (f) => f.importance === "required" && !fieldValues[f.id]?.trim()
  );

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await completeBookingDetails({
        businessId,
        bookingId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        paymentMethod,
        customFieldValues: customFields.map((f) => ({
          fieldId: f.id,
          value: fieldValues[f.id] ?? "",
        })),
      });

      if (!result.ok) {
        if (result.reason === "hold_expired") {
          setError("Your reservation expired while filling this in. Please pick a new time.");
        } else if (result.reason === "invalid_input") {
          setError("Please fill in all required fields.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      router.push(
        result.needsPayment ? `/book/pay/${result.bookingId}` : `/book/confirmed/${result.bookingId}`
      );
    });
  }

  return (
    <div className="flex h-fit flex-col gap-8 rounded-2xl border border-border bg-surface p-8">
      <div className="flex flex-col gap-3.5">
        <div className="text-sm font-medium text-ink">Your details</div>
        <input
          className="rounded-lg border border-border px-4 py-3 text-sm"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-lg border border-border px-4 py-3 text-sm"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="rounded-lg border border-border px-4 py-3 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {customFields.length > 0 && (
        <div className="flex flex-col gap-5 border-t border-border pt-8">
          {customFields.map((f) => (
            <label key={f.id} className="flex flex-col gap-2 text-sm text-ink-secondary">
              <span className="flex items-center gap-1.5">
                {f.label}
                {f.importance === "required" && <span className="text-[#d03b3b]">*</span>}
                {f.importance === "important" && (
                  <span className="rounded-full bg-[#fdf3e6] px-2 py-0.5 text-xs text-[#a8681c]">
                    Important
                  </span>
                )}
              </span>
              <input
                className="w-full rounded-lg border border-border px-4 py-3 text-sm"
                value={fieldValues[f.id] ?? ""}
                onChange={(e) => setFieldValues((v) => ({ ...v, [f.id]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      )}

      {requiresPayment && availableMethods.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-border pt-8">
          <div className="text-sm font-medium text-ink">Pay with</div>
          <div className="flex gap-3">
            {availableMethods.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex-1 rounded-xl border px-3 py-3 text-sm ${
                  paymentMethod === method
                    ? "border-sunburst bg-sunburst/10 font-medium"
                    : "border-border text-ink-secondary"
                }`}
              >
                {METHOD_LABEL[method]}
              </button>
            ))}
          </div>
        </div>
      )}

      {requiresPayment && availableMethods.length === 0 && (
        <div className="rounded-xl border border-[#d03b3b]/30 bg-[#fdecec] px-4 py-3 text-sm text-[#d03b3b]">
          This business hasn&apos;t set up a way to accept payment yet — please contact them
          directly to book this.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {error && <div className="text-sm text-[#d03b3b]">{error}</div>}
        <button
          onClick={submit}
          disabled={
            isPending ||
            !name.trim() ||
            !phone.trim() ||
            !email.trim() ||
            missingRequiredField ||
            (requiresPayment && availableMethods.length === 0)
          }
          className="rounded-xl bg-sunburst py-3.5 text-sm font-medium text-ink disabled:opacity-50"
        >
          {isPending
            ? "Processing..."
            : requiresPayment && paymentMethod !== "cash"
              ? "Continue to payment"
              : "Confirm booking"}
        </button>
      </div>
    </div>
  );
}
