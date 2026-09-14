// No DB imports here on purpose — this is imported by client components
// (e.g. RevenueChart), and pulling in db/client.ts would drag the `pg`
// driver (Node-only: tls, util/types) into the browser bundle.
export function satangToBaht(satang: number): number {
  return satang / 100;
}

export function formatBaht(satang: number): string {
  return `฿${satangToBaht(satang).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}
