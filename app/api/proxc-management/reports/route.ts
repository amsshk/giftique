import { NextResponse } from "next/server";
import { requireOwnerAuth } from "@/lib/proxc/management-auth";
import { runAccountingReport } from "@/lib/proxc/finance";
import { ManagementError } from "@/lib/proxc/management-operations";
import type { AccountingReportId } from "@/lib/management-catalog";

export async function GET(request: Request) {
  const authError = await requireOwnerAuth(request);
  if (authError) return authError;
  const query = new URL(request.url).searchParams;
  try {
    const report = await runAccountingReport(query.get("report") as AccountingReportId, query.get("from") || "", query.get("to") || "");
    return NextResponse.json({ report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "This ERPNext report is unavailable. Check its configuration and the integration account's report permission." }, { status: 502 });
  }
}
