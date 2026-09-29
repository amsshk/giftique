import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/proxc/management-auth";
import { getInvoice, ManagementError } from "@/lib/proxc/management-operations";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const invoice = await getInvoice((await context.params).name);
    return NextResponse.json({ invoice: {
      name: invoice.name,
      customer: invoice.customer,
      customer_name: invoice.customer_name,
      posting_date: invoice.posting_date,
      due_date: invoice.due_date,
      grand_total: invoice.grand_total,
      outstanding_amount: invoice.outstanding_amount,
      status: invoice.status,
      docstatus: invoice.docstatus,
      modified: invoice.modified,
      items: invoice.items?.map(({ item_code, item_name, qty, rate, amount, sales_order }) => ({ item_code, item_name, qty, rate, amount, sales_order })),
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Invoice details are temporarily unavailable." }, { status: 502 });
  }
}
