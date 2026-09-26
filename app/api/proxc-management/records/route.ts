import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/proxc/management-auth";
import { listCustomers, listDeliveryNotes, listProductsAndStock } from "@/lib/proxc/management-operations";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const area = new URL(request.url).searchParams.get("area");
  if (!["customers", "products", "delivery"].includes(area || "")) {
    return NextResponse.json({ error: "Unknown management area." }, { status: 400 });
  }

  try {
    const records = area === "customers"
      ? await listCustomers()
      : area === "products"
        ? await listProductsAndStock()
        : await listDeliveryNotes();
    return NextResponse.json({ records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Business records are temporarily unavailable." }, { status: 502 });
  }
}
