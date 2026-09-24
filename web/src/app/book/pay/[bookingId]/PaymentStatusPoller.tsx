"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PaymentStatusPoller({ bookingId, label }: { bookingId: string; label: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/bookings/${bookingId}/status`);
      if (!res.ok) return;
      const { status } = await res.json();
      if (status === "CONFIRMED") {
        clearInterval(interval);
        router.push(`/book/confirmed/${bookingId}`);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [bookingId, router]);

  return <p className="mt-6 text-sm text-ink-muted">{label}</p>;
}
