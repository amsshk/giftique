import { NextResponse } from "next/server";
import { proxcRequest } from "@/lib/proxc/client";
import { requireManagementAuth } from "@/lib/proxc/management-auth";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const result = await proxcRequest(
      "GET",
      "/api/method/proxc.integrations.giftique_management.overview"
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Giftique overview failed", error);
    return NextResponse.json({ error: "The Giftique overview is temporarily unavailable." }, { status: 502 });
  }
}
