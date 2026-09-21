"use client";

import { useActionState } from "react";
import { connectWhatsApp, disconnectWhatsApp } from "./whatsapp-actions";
import type { ActionResult } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function WhatsAppSection({ connected }: { connected: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    connectWhatsApp,
    null
  );

  if (connected) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <div className="text-sm font-medium text-ink-secondary">WhatsApp</div>
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-[#0ca30c]" />
          Connected — customers who message your number get a tap-to-book menu, no typing
          required.
        </div>
        <ConfirmSubmitButton
          action={disconnectWhatsApp}
          hiddenFields={{}}
          label="Disconnect"
          confirmTitle="Disconnect WhatsApp?"
          confirmDescription="Customers messaging your number will stop getting the booking menu until you reconnect."
          confirmLabel="Disconnect"
          danger
          buttonClassName="self-start rounded-full border border-border px-3 py-1.5 text-sm text-ink-secondary hover:bg-page"
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="text-sm font-medium text-ink-secondary">WhatsApp</div>
      <p className="text-sm text-ink-muted">
        Connect your own WhatsApp Business number — customers who message it get a simple
        tap-to-book menu (no free-text chat, no AI guessing what they meant). Get a phone number
        ID and access token from your{" "}
        <a
          href="https://business.facebook.com/wa/manage/phone-numbers/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Meta Business Manager
        </a>{" "}
        first.
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <input
          name="phoneNumberId"
          placeholder="Phone number ID"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        <input
          name="accessToken"
          type="password"
          placeholder="Access token"
          className="rounded-lg border border-border px-3 py-2 text-sm"
        />
        {state && !state.ok && <div className="text-sm text-[#d03b3b]">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-xl bg-sunburst px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-50"
        >
          {pending ? "Connecting..." : "Connect WhatsApp"}
        </button>
      </form>
    </div>
  );
}
