import { NextResponse } from "next/server";
import { proxcRequest } from "@/lib/proxc/client";

export async function GET() {
  try {
    const result = await proxcRequest(
      "GET",
      "/api/method/proxc.integrations.giftique.health"
    );

    return NextResponse.json({
      ok: true,
      proxc: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "PROXC connection failed",
      },
      { status: 502 }
    );
  }
}
