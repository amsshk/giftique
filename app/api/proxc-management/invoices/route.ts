import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/proxc/management-auth";
import { listInvoices } from "@/lib/proxc/management-operations";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const invoices = await listInvoices();
    return NextResponse.json({ invoices }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Invoices are temporarily unavailable." }, { status: 502 });
  }
}
