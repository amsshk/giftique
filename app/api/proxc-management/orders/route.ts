import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/proxc/management-auth";
import { listOrders } from "@/lib/proxc/management-operations";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const orders = await listOrders();
    return NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Orders are temporarily unavailable." }, { status: 502 });
  }
}
