import { NextResponse } from "next/server";
import { z } from "zod";
import { managementIdentity } from "@/lib/proxc/management-auth";
import { proxcRequest } from "@/lib/proxc/client";

const name = z.string().min(1).max(140);
const kind = z.enum(["sales_invoices", "purchase_invoices"]);
const reads = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list_files"), page: z.coerce.number().int().min(0).max(10000).default(0), search: z.string().max(80).default("") }).strict(),
  z.object({ action: z.literal("invoice_choices"), kind, search: z.string().max(80).default("") }).strict(),
  z.object({ action: z.literal("download"), name }).strict(),
]);
const writes = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upload"), filename: name.regex(/\.(pdf|png|jpe?g)$/i), content: z.string().min(1).max(6666668).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),
  z.object({ action: z.literal("link"), name, kind, invoice: name, expected_modified: z.string().min(1).max(100) }).strict(),
]);

function failure(error: unknown) {
  if (error instanceof Error) {
    const raw = error.message.match(/^PROXC API \d+: ([\s\S]+)$/)?.[1];
    try {
      const type = raw ? JSON.parse(raw).exc_type : "";
      if (type === "PermissionError") return NextResponse.json({ error: "You do not have access to this invoice file." }, { status: 403 });
      if (type === "TimestampMismatchError") return NextResponse.json({ error: "This file changed. Refresh before linking it again." }, { status: 409 });
      if (["ValidationError", "DoesNotExistError"].includes(type)) return NextResponse.json({ error: "Check the invoice and file. Upload a readable PDF, PNG or JPEG, up to 5 MB; password-protected PDFs are not supported." }, { status: 400 });
    } catch { /* Do not expose ERPNext response bodies. */ }
  }
  return NextResponse.json({ error: "Invoice files are temporarily unavailable. Please try again." }, { status: 502 });
}
const endpoint = "/api/method/proxc.integrations.giftique_invoice_files.";

export async function GET(request: Request) {
  const identity = await managementIdentity(request, ["owner"]);
  if (identity.error) return identity.error;
  const parsed = reads.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invoice file request." }, { status: 400 });
  const { action, ...data } = parsed.data;
  try {
    const query = new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)]));
    const result = await proxcRequest("GET", `${endpoint}${action}?${query}`) as { message: unknown };
    if (action === "download") {
      const file = result.message as { filename: string; content: string };
      const filename = file.filename.replace(/[^a-zA-Z0-9_. -]/g, "_");
      const extension = filename.split(".").pop()?.toLowerCase();
      const type = extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : "image/jpeg";
      return new Response(Buffer.from(file.content, "base64"), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return NextResponse.json(result.message, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const identity = await managementIdentity(request, ["owner"]);
  if (identity.error) return identity.error;
  // Bound the stream before parsing base64; Content-Length alone is not trusted.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 6700000) { await reader.cancel(); return NextResponse.json({ error: "Choose a file no larger than 5 MB." }, { status: 413 }); }
    chunks.push(value);
  }
  let json: unknown;
  try { json = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return NextResponse.json({ error: "Invalid upload request." }, { status: 400 }); }
  const parsed = writes.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Choose a PDF, PNG or JPEG up to 5 MB, and check the invoice details." }, { status: 400 });
  const { action, ...data } = parsed.data;
  try {
    const result = await proxcRequest("POST", `${endpoint}${action}`, { ...data, actor: identity.user!.id }) as { message: unknown };
    return NextResponse.json(result.message, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
