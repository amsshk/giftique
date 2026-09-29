import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/proxc/management-auth";
import { getOrder, ManagementError } from "@/lib/proxc/management-operations";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const order = await getOrder((await context.params).name);
    return NextResponse.json({ order: {
      name: order.name,
      customer: order.customer,
      customer_name: order.customer_name,
      transaction_date: order.transaction_date,
      delivery_date: order.delivery_date,
      grand_total: order.grand_total,
      status: order.status,
      docstatus: order.docstatus,
      modified: order.modified,
      items: order.items?.map(({ item_code, item_name, qty, rate, amount }) => ({ item_code, item_name, qty, rate, amount })),
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Order details are temporarily unavailable." }, { status: 502 });
  }
}
