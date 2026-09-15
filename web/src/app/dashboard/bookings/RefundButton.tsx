"use client";

import { useState, useTransition } from "react";
import { refundBooking } from "./actions";
import { formatBaht } from "@/lib/money";

export function RefundButton({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amountBaht, setAmountBaht] = useState(String(amount / 100));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await refundBooking(bookingId, mode === "full" ? null : Number(amountBaht));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-page"
      >
        Refund
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-page p-3 text-xs">
      <div className="flex gap-3">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "full"}
            onChange={() => setMode("full")}
          />
          Full ({formatBaht(amount)})
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "partial"}
            onChange={() => setMode("partial")}
          />
          Partial
        </label>
        {mode === "partial" && (
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountBaht}
            onChange={(e) => setAmountBaht(e.target.value)}
            className="w-24 rounded-lg border border-border px-2 py-1 text-xs"
          />
        )}
      </div>
      {error && <div className="text-[#d03b3b]">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-ink disabled:opacity-50"
        >
          {isPending ? "Refunding..." : "Confirm refund"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-full border border-border px-3 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  );
}
