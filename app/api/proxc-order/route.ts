import { NextResponse } from "next/server";
import { proxcRequest } from "@/lib/proxc/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await proxcRequest(
      "POST",
      "/api/method/proxc.integrations.giftique.create_order",
      body
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create order in PROXC",
      },
      { status: 502 }
    );
  }
}
