import { proxcRequest } from "./client";

const COMPANY = "Giftique";
const WAREHOUSE = "Finished Goods - G";
const MAX_ROWS = 100;
const invoiceLocks = new Set<string>();

export class ManagementError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type FrappeResource<T> = { data: T };
type FrappeList<T> = { data: T[] };
type FrappeMethod<T> = { message: T };

export type OrderItem = {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
};

export type Order = {
  doctype: "Sales Order";
  name: string;
  company: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string;
  grand_total: number;
  status: string;
  docstatus: number;
  modified: string;
  items: OrderItem[];
};

export type Invoice = {
  doctype: "Sales Invoice";
  name: string;
  company: string;
  customer: string;
  customer_name: string;
  posting_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
  docstatus: number;
  modified: string;
  items: (OrderItem & { sales_order?: string })[];
};

function validateName(name: string) {
  if (!/^[A-Za-z0-9_.-]{1,140}$/.test(name)) {
    throw new ManagementError("Invalid record name.", 400);
  }
}

function resourcePath(doctype: string, name?: string) {
  return `/api/resource/${encodeURIComponent(doctype)}${name ? `/${encodeURIComponent(name)}` : ""}`;
}

async function getResource<T>(doctype: string, name: string): Promise<T> {
  validateName(name);
  const result = await proxcRequest("GET", resourcePath(doctype, name)) as FrappeResource<T>;
  if (!result?.data) throw new Error(`ERPNext did not return ${doctype}.`);
  return result.data;
}

async function listResource<T>(doctype: string, fields: string[], filters: unknown, orderBy = "creation desc") {
  const query = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    order_by: orderBy,
    limit_page_length: String(MAX_ROWS),
  });
  const result = await proxcRequest("GET", `${resourcePath(doctype)}?${query}`) as FrappeList<T>;
  if (!Array.isArray(result?.data)) throw new Error(`ERPNext did not return a ${doctype} list.`);
  return result.data;
}

function requireGiftique(doc: { company: string }) {
  if (doc.company !== COMPANY) throw new ManagementError("Giftique record not found.", 404);
}

function requireCurrent(modified: string, expectedModified: string) {
  if (!expectedModified || modified !== expectedModified) {
    throw new ManagementError("This record changed. Refresh it before continuing.", 409);
  }
}

export async function listOrders() {
  return listResource<Omit<Order, "items">>(
    "Sales Order",
    ["name", "company", "customer", "customer_name", "transaction_date", "grand_total", "status", "docstatus", "modified"],
    [["company", "=", COMPANY]],
  );
}

export async function listCustomers() {
  const orders = await listOrders();
  const names = [...new Set(orders.map(order => order.customer).filter(Boolean))];
  if (!names.length) return [];
  return listResource<{ name: string; customer_name: string; email_id: string; mobile_no: string }>(
    "Customer",
    ["name", "customer_name", "email_id", "mobile_no"],
    [["name", "in", names]],
    "customer_name asc",
  );
}

export async function listProductsAndStock() {
  const [items, prices, stock] = await Promise.all([
    listResource<{ name: string; item_name: string; stock_uom: string }>(
      "Item", ["name", "item_name", "stock_uom"],
      [["item_code", "like", "GFT-%"], ["disabled", "=", 0]], "item_code asc",
    ),
    listResource<{ item_code: string; price_list_rate: number; currency: string }>(
      "Item Price", ["item_code", "price_list_rate", "currency"],
      [["item_code", "like", "GFT-%"], ["price_list", "=", "Standard Selling"], ["selling", "=", 1]],
    ),
    listResource<{ item_code: string; actual_qty: number; reserved_qty: number; projected_qty: number }>(
      "Bin", ["item_code", "actual_qty", "reserved_qty", "projected_qty"],
      [["warehouse", "=", WAREHOUSE], ["item_code", "like", "GFT-%"]], "item_code asc",
    ),
  ]);
  const priceByItem = new Map(prices.map(price => [price.item_code, price]));
  const stockByItem = new Map(stock.map(bin => [bin.item_code, bin]));
  return items.map(item => ({
    item_code: item.name,
    item_name: item.item_name,
    stock_uom: item.stock_uom,
    price: priceByItem.get(item.name)?.price_list_rate ?? null,
    currency: priceByItem.get(item.name)?.currency ?? null,
    actual_qty: stockByItem.get(item.name)?.actual_qty ?? 0,
    reserved_qty: stockByItem.get(item.name)?.reserved_qty ?? 0,
    projected_qty: stockByItem.get(item.name)?.projected_qty ?? 0,
  }));
}

export async function listDeliveryNotes() {
  return listResource<{ name: string; customer_name: string; posting_date: string; status: string; grand_total: number; docstatus: number }>(
    "Delivery Note",
    ["name", "customer_name", "posting_date", "status", "grand_total", "docstatus"],
    [["company", "=", COMPANY]],
  );
}

export async function listInvoices() {
  return listResource<Omit<Invoice, "items">>(
    "Sales Invoice",
    ["name", "company", "customer_name", "posting_date", "grand_total", "outstanding_amount", "status", "docstatus", "modified"],
    [["company", "=", COMPANY]],
  );
}

export async function getOrder(name: string) {
  const order = await getResource<Order>("Sales Order", name);
  requireGiftique(order);
  return order;
}

export async function getInvoice(name: string) {
  const invoice = await getResource<Invoice>("Sales Invoice", name);
  requireGiftique(invoice);
  return invoice;
}

export async function submitOrder(name: string, expectedModified: string) {
  const order = await getOrder(name);
  requireCurrent(order.modified, expectedModified);
  if (order.docstatus !== 0) throw new ManagementError("Only draft orders can be submitted.", 409);
  if (!order.items?.length) throw new ManagementError("This order has no items.", 409);
  const result = await proxcRequest("POST", "/api/method/frappe.client.submit", { doc: order }) as FrappeMethod<Order>;
  if (result?.message?.docstatus !== 1) throw new Error("ERPNext did not confirm order submission.");
  requireGiftique(result.message);
  return result.message;
}

export async function createDraftInvoice(orderName: string, expectedModified: string) {
  if (invoiceLocks.has(orderName)) throw new ManagementError("Invoice creation is already in progress for this order.", 409);
  invoiceLocks.add(orderName);
  try {
    const order = await getOrder(orderName);
    requireCurrent(order.modified, expectedModified);
    if (order.docstatus !== 1) throw new ManagementError("Submit the sales order before creating an invoice.", 409);

    const existing = await listResource<{ parent: string }>(
      "Sales Invoice Item",
      ["parent"],
      [["sales_order", "=", order.name], ["docstatus", "!=", 2]],
    );
    if (existing.length) throw new ManagementError(`An invoice already exists for this order: ${existing[0].parent}.`, 409);

    const mapped = await proxcRequest("POST", "/api/method/erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice", {
      source_name: order.name,
    }) as FrappeMethod<Invoice>;
    const draft = mapped?.message;
    if (!draft || draft.doctype !== "Sales Invoice" || draft.company !== COMPANY || draft.customer !== order.customer || draft.docstatus !== 0 || !draft.items?.length || !draft.items.every(item => item.sales_order === order.name)) {
      throw new Error("ERPNext did not map a valid Giftique invoice.");
    }

    const inserted = await proxcRequest("POST", "/api/method/frappe.client.insert", { doc: draft }) as FrappeMethod<Invoice>;
    if (!inserted?.message?.name || inserted.message.docstatus !== 0 || inserted.message.customer !== order.customer || !inserted.message.items?.length || !inserted.message.items.every(item => item.sales_order === order.name)) {
      throw new Error("ERPNext did not confirm draft invoice creation.");
    }
    requireGiftique(inserted.message);
    return inserted.message;
  } finally {
    invoiceLocks.delete(orderName);
  }
}

export async function submitInvoice(name: string, expectedModified: string) {
  const invoice = await getInvoice(name);
  requireCurrent(invoice.modified, expectedModified);
  if (invoice.docstatus !== 0) throw new ManagementError("Only draft invoices can be submitted.", 409);
  if (!invoice.items?.length) throw new ManagementError("This invoice has no items.", 409);
  const result = await proxcRequest("POST", "/api/method/frappe.client.submit", { doc: invoice }) as FrappeMethod<Invoice>;
  if (result?.message?.docstatus !== 1) throw new Error("ERPNext did not confirm invoice submission.");
  requireGiftique(result.message);
  return result.message;
}
