import { NextResponse } from "next/server";
import { z } from "zod";
import { managementIdentity } from "@/lib/proxc/management-auth";
import { proxcRequest } from "@/lib/proxc/client";

const text = z.string().max(2000);
const name = z.string().min(1).max(140);
const kind = z.enum(["employees", "customers", "suppliers", "accounts", "bank_accounts", "banks", "holiday_lists", "holiday_assignments", "departments", "designations", "purchase_invoices", "payments", "journals", "salary_components", "salary_structures", "salary_assignments", "salary_slips", "payroll_runs"]);
const printKind = z.enum(["invoice", "order", "delivery", "salary_slip", "purchase_invoice"]);
const current = { name, expected_modified: z.string().min(1).max(100) };
const mutations = z.discriminatedUnion("action", [
  z.object({ action: z.literal("letter_pdf"), recipient: text, subject: z.string().min(1).max(200), message: z.string().min(1).max(10000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
  z.object({ action: z.literal("save_record"), kind, data: z.record(z.unknown()), request_id: z.string().uuid(), name: name.optional(), expected_modified: text.optional(), record_name: name.optional() }).strict(),
  z.object({ action: z.literal("submit_record"), kind, ...current }).strict(),
  z.object({ action: z.literal("submit_payroll_slips"), ...current }).strict(),
  z.object({ action: z.literal("retry_payroll_slips"), ...current }).strict(),
  z.object({ action: z.literal("create_payment"), direction: z.enum(["Receive", "Pay"]), invoice: name, account: name, amount: z.number().positive().finite(), reference_no: z.string().max(140), reference_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), expected_modified: text, request_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("credit_note"), invoice: name, expected_modified: text, request_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("save_profile"), data: z.object({ display_name: text, address: text, email: z.union([z.literal(""), z.string().email()]), phone_no: text, website: text, tax_id: text }).strict(), expected_modified: text }).strict(),
  z.object({ action: z.literal("upload_logo"), content: z.string().max(4000000) }).strict(),
  z.object({ action: z.literal("email_document"), kind: printKind, name, recipient: z.string().email(), subject: z.string().min(1).max(200), message: z.string().max(10000), request_id: z.string().uuid() }).strict(),
]);
const reads = z.discriminatedUnion("action", [
  z.object({ action: z.literal("capabilities") }).strict(),
  z.object({ action: z.literal("records"), kind, page: z.coerce.number().int().min(0).max(10000).default(0), search: z.string().max(80).default("") }).strict(),
  z.object({ action: z.literal("record"), kind: z.union([kind, z.literal("sales_invoices")]), name }).strict(),
  z.object({ action: z.literal("choices"), kind, field: name, table: name.optional(), search: z.string().max(80).default("") }).strict(),
  z.object({ action: z.literal("bank_balances"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
  z.object({ action: z.literal("invoice_choices"), direction: z.enum(["Receive", "Pay"]), search: z.string().max(80).default("") }).strict(),
  z.object({ action: z.literal("document_pdf"), kind: printKind, name }).strict(),
]);

function failure(error: unknown) {
  // Only return ERPNext's user-facing validation messages, never a traceback or raw response.
  if (error instanceof Error) {
    const match = error.message.match(/^PROXC API (\d+): ([\s\S]+)$/);
    if (match) {
      try {
        const response = JSON.parse(match[2]);
        if (["ValidationError", "MandatoryError", "LinkValidationError", "TimestampMismatchError", "DuplicateEntryError", "PermissionError", "DoesNotExistError", "InvalidEmailAddressError"].includes(response.exc_type)) {
          const messages = JSON.parse(response._server_messages || "[]").map((entry: string) => JSON.parse(entry).message);
          const message = String(messages.join(" ") || "ERPNext rejected this action. Refresh and check the record.").replace(/<[^>]*>/g, "").slice(0, 800);
          return NextResponse.json({ error: message }, { status: response.exc_type === "PermissionError" ? 403 : 409 });
        }
      } catch { /* Generic message below. */ }
    }
  }
  return NextResponse.json({ error: "ERPNext could not complete this request. Check the required setup and refresh before retrying." }, { status: 502 });
}
async function call(method: string, action: string, data: Record<string, unknown>) {
  const result = await proxcRequest(method, `/api/method/proxc.integrations.giftique_business.${action}`, data) as { message: unknown };
  return result.message;
}
export async function GET(request: Request) {
  const identity = await managementIdentity(request, ["owner"]);
  if (identity.error) return identity.error;
  const parsed = reads.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid business request." }, { status: 400 });
  const { action, ...data } = parsed.data;
  try {
    const query = new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)]));
    const result = await proxcRequest("GET", `/api/method/proxc.integrations.giftique_business.${action}?${query}`) as { message: unknown };
    if (action === "document_pdf") {
      const pdf = result.message as { filename: string; content: string };
      return new Response(Buffer.from(pdf.content, "base64"), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`, "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(result.message, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const identity = await managementIdentity(request, ["owner"]);
  if (identity.error) return identity.error;
  const body = await request.text();
  if (body.length > 4100000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = mutations.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Check the required form fields." }, { status: 400 });
  const { action, ...data } = parsed.data;
  try {
    const result = await call("POST", action, { ...data, actor: identity.user!.id });
    if (action === "letter_pdf") {
      const pdf = result as { content: string };
      return new Response(Buffer.from(pdf.content, "base64"), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="Giftique-letter.pdf"', "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
