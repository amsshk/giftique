import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";

const buildDir = mkdtempSync(join(tmpdir(), "giftique-management-test-"));
for (const name of ["client", "management-operations"]) {
  const source = readFileSync(resolve(`lib/proxc/${name}.ts`), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace('from "./client"', 'from "./client.mjs"');
  writeFileSync(join(buildDir, `${name}.mjs`), compiled);
}
const operations = await import(`file://${join(buildDir, "management-operations.mjs")}`);
after(() => rmSync(buildDir, { recursive: true, force: true }));

process.env.PROXC_URL = "http://proxc.test";
process.env.PROXC_API_KEY = "local-test-key";
process.env.PROXC_API_SECRET = "local-test-secret";

const order = {
  doctype: "Sales Order", name: "SAL-ORD-TEST-1", company: "Giftique", customer: "CUST-TEST",
  customer_name: "Test Customer", modified: "2026-09-26 10:00:00", docstatus: 1, status: "To Bill",
  items: [{ item_code: "GFT-001", item_name: "Gift", qty: 1, rate: 100, amount: 100 }],
};
const mappedInvoice = {
  doctype: "Sales Invoice", company: "Giftique", customer: "CUST-TEST", docstatus: 0,
  items: [{ item_code: "GFT-001", sales_order: order.name, qty: 1, rate: 100, amount: 100 }],
};

function mockProxc(responder) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const request = { path: new URL(input).pathname, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(request);
    const result = await responder(request);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  return calls;
}

test("a staff action cannot submit another company's order", async () => {
  const calls = mockProxc(() => ({ data: { ...order, company: "Other Company", docstatus: 0 } }));
  await assert.rejects(operations.submitOrder(order.name, order.modified), { status: 404 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
});

test("a changed order must be refreshed before submission", async () => {
  const calls = mockProxc(() => ({ data: { ...order, docstatus: 0 } }));
  await assert.rejects(operations.submitOrder(order.name, "stale timestamp"), { status: 409 });
  assert.equal(calls.length, 1);
});

test("an order must be submitted before an invoice is created", async () => {
  const calls = mockProxc(() => ({ data: { ...order, docstatus: 0 } }));
  await assert.rejects(operations.createDraftInvoice(order.name, order.modified), { status: 409 });
  assert.equal(calls.length, 1);
});

test("an existing invoice blocks a second draft", async () => {
  const calls = mockProxc(({ path }) => path.includes("Sales%20Invoice%20Item")
    ? { data: [{ parent: "SINV-EXISTING" }] }
    : { data: order });
  await assert.rejects(operations.createDraftInvoice(order.name, order.modified), { status: 409, message: /SINV-EXISTING/ });
  assert.equal(calls.length, 2);
  assert.equal(calls.some(call => call.path.includes("make_sales_invoice")), false);
});

test("a submitted order maps to one ERPNext draft invoice", async () => {
  const calls = mockProxc(({ path }) => {
    if (path.includes("Sales%20Invoice%20Item")) return { data: [] };
    if (path.includes("make_sales_invoice")) return { message: mappedInvoice };
    if (path.includes("frappe.client.insert")) return { message: { ...mappedInvoice, name: "SINV-TEST-1" } };
    return { data: order };
  });
  const invoice = await operations.createDraftInvoice(order.name, order.modified);
  assert.equal(invoice.name, "SINV-TEST-1");
  assert.equal(invoice.docstatus, 0);
  assert.equal(calls.filter(call => call.path.includes("frappe.client.insert")).length, 1);
  assert.equal(calls.find(call => call.path.includes("frappe.client.insert")).body.doc.customer, order.customer);
});

test("an invoice with an unrelated mapped order is rejected before insertion", async () => {
  const calls = mockProxc(({ path }) => {
    if (path.includes("Sales%20Invoice%20Item")) return { data: [] };
    if (path.includes("make_sales_invoice")) return { message: { ...mappedInvoice, items: [{ ...mappedInvoice.items[0], sales_order: "OTHER" }] } };
    return { data: order };
  });
  await assert.rejects(operations.createDraftInvoice(order.name, order.modified), /did not map a valid Giftique invoice/);
  assert.equal(calls.some(call => call.path.includes("frappe.client.insert")), false);
});
