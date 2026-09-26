import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function requireManagementAuth(request: Request): Promise<NextResponse | null> {
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

  return null;
}
