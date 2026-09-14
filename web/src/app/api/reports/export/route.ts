import { NextResponse } from "next/server";
import { getCurrentOwner } from "@/lib/auth";
import { getBookingRowsForExport } from "@/lib/reports-data";
import { resolveReportRange, type ReportRangeKey } from "@/lib/reports-data";
import { todayISOInBangkok } from "@/lib/bookings-data";
import { satangToBaht } from "@/lib/money";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: Request) {
  // getCurrentOwner (not requireOwner) on purpose: this is a plain HTTP
  // endpoint reached via a download link, not a page render — a redirect()
  // here would just be a 307 the download has to follow, not a useful
  // browser navigation, so return a plain 401 instead.
  const owner = await getCurrentOwner();
  if (!owner) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rangeKey = (searchParams.get("range") ?? "month") as ReportRangeKey;
  const { startISO, endISO } = resolveReportRange(rangeKey, todayISOInBangkok());

  const rows = await getBookingRowsForExport(owner.businessId, startISO, endISO);

  const header = [
    "Date",
    "Status",
    "Amount (THB)",
    "Service",
    "Staff",
    "Customer",
    "Phone",
    "Email",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.start_time).toISOString(),
        r.status,
        satangToBaht(r.amount).toFixed(2),
        r.service_name,
        r.staff_name,
        r.customer_name ?? "",
        r.customer_phone ?? "",
        r.customer_email ?? "",
      ]
        .map((v) => csvEscape(String(v)))
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="velure-bookings-${rangeKey}.csv"`,
    },
  });
}
