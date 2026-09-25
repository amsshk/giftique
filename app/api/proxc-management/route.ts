import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { proxcRequest } from "@/lib/proxc/client";

export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Authentication is unavailable." }, { status: 503 });

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(bearer);
  if (error || !data.user) return NextResponse.json({ error: "Session expired." }, { status: 401 });
  if (!["owner", "staff"].includes(data.user.app_metadata?.role)) {
    return NextResponse.json({ error: "Giftique management access is required." }, { status: 403 });
  }

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
