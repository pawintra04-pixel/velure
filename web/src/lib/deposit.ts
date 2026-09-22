// A deposit-mode service's real amount comes from exactly one of two
// columns (see 032_deposit_and_cutoff_policy.sql's XOR constraint) — every
// place that turns a service into a booking amount needs the same
// resolution logic, so it lives here once instead of being reimplemented
// per call site.
export function effectiveDepositAmount(service: {
  priceAmount: number;
  depositAmount: number | null;
  depositPercent: number | null;
}): number {
  if (service.depositAmount != null) return service.depositAmount;
  if (service.depositPercent != null) {
    return Math.round((service.priceAmount * service.depositPercent) / 100);
  }
  return 0;
}
