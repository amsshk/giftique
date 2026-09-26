import { NextResponse } from "next/server";
import { z } from "zod";
import { requireManagementAuth } from "@/lib/proxc/management-auth";
import { createDraftInvoice, ManagementError, submitInvoice, submitOrder } from "@/lib/proxc/management-operations";

const actionSchema = z.object({
  action: z.enum(["submit_order", "create_invoice", "submit_invoice"]),
  name: z.string().regex(/^[A-Za-z0-9_.-]{1,140}$/),
  expectedModified: z.string().min(1).max(100),
}).strict();

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid management action." }, { status: 400 });

  const { action, name, expectedModified } = parsed.data;
  try {
    const record = action === "submit_order"
      ? await submitOrder(name, expectedModified)
      : action === "create_invoice"
        ? await createDraftInvoice(name, expectedModified)
        : await submitInvoice(name, expectedModified);
    return NextResponse.json({ record: { name: record.name, status: record.status, docstatus: record.docstatus } }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ManagementError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "ERPNext could not complete this action. Refresh the record before retrying." }, { status: 502 });
  }
}
