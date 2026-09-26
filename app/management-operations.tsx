"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClipboardList, FileText, Package, RefreshCw, Truck, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export type Area = "orders" | "invoices" | "customers" | "products" | "delivery";
type Action = "submit_order" | "create_invoice" | "submit_invoice";
type Item = { item_code: string; item_name: string; qty: number; rate: number; amount: number; sales_order?: string };
type Order = { name: string; customer: string; customer_name: string; transaction_date: string; delivery_date: string; grand_total: number; status: string; docstatus: number; modified: string; items: Item[] };
type Invoice = { name: string; customer: string; customer_name: string; posting_date: string; due_date: string; grand_total: number; outstanding_amount: number; status: string; docstatus: number; modified: string; items: Item[] };
type Customer = { name: string; customer_name: string; email_id: string; mobile_no: string };
type Product = { item_code: string; item_name: string; price: number | null; currency: string | null; actual_qty: number; reserved_qty: number; projected_qty: number; stock_uom: string };
type Delivery = { name: string; customer_name: string; posting_date: string; status: string; grand_total: number; docstatus: number };

const areas = [
  { id: "orders", title: "Orders", description: "Review and submit customer orders.", icon: ClipboardList },
  { id: "invoices", title: "Invoices", description: "Review and submit sales invoices.", icon: FileText },
  { id: "customers", title: "Customers", description: "Customers with recent Giftique orders.", icon: Users },
  { id: "products", title: "Products & stock", description: "Selling prices and finished goods stock.", icon: Package },
  { id: "delivery", title: "Delivery", description: "Giftique delivery notes and progress.", icon: Truck },
] as const;

const money = (amount: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(amount);

export default function ManagementOperations({ onChanged, renderOverview }: {
  onChanged: () => void;
  renderOverview: (openArea: (area: Area, draftOnly?: boolean) => void) => ReactNode;
}) {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [area, setArea] = useState<Area | null>(null);
  const [draftOnly, setDraftOnly] = useState(false);
  const [navigationCount, setNavigationCount] = useState(0);
  const recordsRef = useRef<HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [delivery, setDelivery] = useState<Delivery[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: Action; name: string; modified: string } | null>(null);

  useEffect(() => {
    const records = recordsRef.current;
    if (!records) return;
    records.focus({ preventScroll: true });
    records.scrollIntoView({ behavior: "instant", block: "start" });
  }, [navigationCount]);

  async function api(path: string, options?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sign in again to continue.");
    const response = await fetch(path, {
      ...options,
      headers: { ...options?.headers, Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const data = await response.json() as { error?: string; [key: string]: unknown };
    if (!response.ok) throw new Error(data.error || "ERPNext is temporarily unavailable.");
    return data;
  }

  async function loadArea(next: Area, onlyDrafts = false) {
    setArea(next);
    setDraftOnly(next === "orders" && onlyDrafts);
    setNavigationCount(value => value + 1);
    setSelectedOrder(null);
    setSelectedInvoice(null);
    setConfirmation(null);
    setError("");
    setLoading(true);
    try {
      if (next === "orders") {
        const data = await api(`/api/proxc-management/orders${onlyDrafts ? "?status=draft" : ""}`);
        setOrders(data.orders as Order[]);
      } else if (next === "invoices") {
        const data = await api("/api/proxc-management/invoices");
        setInvoices(data.invoices as Invoice[]);
      } else {
        const data = await api(`/api/proxc-management/records?area=${next}`);
        if (next === "customers") setCustomers(data.records as Customer[]);
        if (next === "products") setProducts(data.records as Product[]);
        if (next === "delivery") setDelivery(data.records as Delivery[]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Business records are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrder(name: string) {
    setError("");
    setDetailLoading(true);
    try {
      const data = await api(`/api/proxc-management/orders/${encodeURIComponent(name)}`);
      setSelectedOrder(data.order as Order);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order details are temporarily unavailable.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadInvoice(name: string) {
    setError("");
    setDetailLoading(true);
    try {
      const data = await api(`/api/proxc-management/invoices/${encodeURIComponent(name)}`);
      setSelectedInvoice(data.invoice as Invoice);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invoice details are temporarily unavailable.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function performAction() {
    if (!confirmation) return;
    const { action, name, modified } = confirmation;
    setBusy(true);
    setError("");
    setConfirmation(null);
    let record: { name: string };
    try {
      const data = await api("/api/proxc-management/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name, expectedModified: modified }),
      });
      record = data.record as { name: string };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ERPNext could not complete this action.");
      setBusy(false);
      return;
    }

    onChanged();
    setNotice(action === "create_invoice"
      ? `Draft invoice ${record.name} was created in ERPNext. Review it before submitting.`
      : action === "submit_order"
        ? `Sales Order ${record.name} was submitted in ERPNext.`
        : `Sales Invoice ${record.name} was submitted in ERPNext.`);
    try {
      if (action === "create_invoice") {
        await loadArea("invoices");
        await loadInvoice(record.name);
      } else if (action === "submit_order") {
        await loadArea("orders");
        await loadOrder(record.name);
      } else {
        await loadArea("invoices");
        await loadInvoice(record.name);
      }
    } finally {
      setBusy(false);
    }
  }

  return <>
    {renderOverview((next, onlyDrafts) => { setNotice(""); void loadArea(next, onlyDrafts); })}
    <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Giftique operations">
      {areas.map(({ id, title, description, icon: Icon }) => <button key={id} type="button" onClick={() => { setNotice(""); void loadArea(id); }} aria-pressed={area === id} aria-controls="management-records"
        className={`rounded-2xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${area === id ? "border-[#8b6f47]" : "border-[#e5dfd8]"}`}>
        <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1ece5]"><Icon size={21} /></span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-2 block text-sm leading-5 text-[#716b66]">{description}</span>
      </button>)}
    </section>

    {area && <section ref={recordsRef} id="management-records" tabIndex={-1} aria-busy={loading} className="mt-8 scroll-mt-6 rounded-2xl border border-[#e5dfd8] bg-white p-7 shadow-sm" aria-label={`${draftOnly ? "draft orders" : area} records`}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{draftOnly ? "Draft orders" : areas.find(item => item.id === area)?.title}</h2><button type="button" onClick={() => void loadArea(area, draftOnly)} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-lg border border-[#e5dfd8] px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button></div>
      {error && <p role="alert" className="mt-4 text-sm text-[#a33737]">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-[#276344]">{notice}</p>}
      {loading ? <p className="mt-5 text-sm text-[#716b66]">Loading ERPNext records…</p> : <div className="mt-5 divide-y divide-[#eee9e3]">
        {area === "orders" && (orders.length ? orders.map(order => <div key={order.name} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{order.name}</strong><p className="text-[#716b66]">{order.customer_name} · {order.status} · {money(order.grand_total)}</p></div><button type="button" onClick={() => void loadOrder(order.name)} className="font-medium underline underline-offset-4">Review order</button></div>) : <p className="py-3 text-sm text-[#716b66]">{draftOnly ? "No draft Giftique orders." : "No Giftique orders yet."}</p>)}
        {area === "invoices" && (invoices.length ? invoices.map(invoice => <div key={invoice.name} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{invoice.name}</strong><p className="text-[#716b66]">{invoice.customer_name} · {invoice.status} · {money(invoice.grand_total)}</p></div><button type="button" onClick={() => void loadInvoice(invoice.name)} className="font-medium underline underline-offset-4">Review invoice</button></div>) : <p className="py-3 text-sm text-[#716b66]">No Giftique invoices yet. Submit an order, then create its invoice.</p>)}
        {area === "customers" && (customers.length ? customers.map(customer => <div key={customer.name} className="py-3 text-sm"><strong>{customer.customer_name}</strong><p className="text-[#716b66]">{customer.email_id || "No email"}{customer.mobile_no ? ` · ${customer.mobile_no}` : ""}</p></div>) : <p className="py-3 text-sm text-[#716b66]">No customers with recent Giftique orders.</p>)}
        {area === "products" && (products.length ? products.map(product => <div key={product.item_code} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><strong>{product.item_name}</strong><p className="text-[#716b66]">{product.item_code} · {product.price === null ? "No selling price" : money(product.price)}</p></div><div className="text-right"><strong>{product.actual_qty} {product.stock_uom}</strong><p className="text-[#716b66]">Reserved {product.reserved_qty} · Projected {product.projected_qty}</p></div></div>) : <p className="py-3 text-sm text-[#716b66]">No active Giftique products.</p>)}
        {area === "delivery" && (delivery.length ? delivery.map(note => <div key={note.name} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><strong>{note.name}</strong><p className="text-[#716b66]">{note.customer_name} · {note.status}</p></div><span>{note.posting_date}</span></div>) : <p className="py-3 text-sm text-[#716b66]">No Giftique delivery notes yet.</p>)}
      </div>}

      {detailLoading && <p className="mt-5 text-sm text-[#716b66]">Loading record details…</p>}
      {area === "orders" && selectedOrder && !detailLoading && <div className="mt-7 rounded-xl bg-[#f7f5f2] p-5"><h3 className="text-lg font-semibold">Order {selectedOrder.name}</h3><p className="mt-1 text-sm text-[#716b66]">{selectedOrder.customer_name} · {selectedOrder.status} · Ordered {selectedOrder.transaction_date}</p><div className="mt-4 divide-y divide-[#e5dfd8]">{selectedOrder.items.map((item, index) => <div key={`${item.item_code}-${index}`} className="flex justify-between gap-3 py-2 text-sm"><span>{item.item_name || item.item_code} · {item.qty} × {money(item.rate)}</span><strong>{money(item.amount)}</strong></div>)}</div><p className="mt-3 text-right font-semibold">Total {money(selectedOrder.grand_total)}</p><div className="mt-5 flex flex-wrap gap-3">{selectedOrder.docstatus === 0 && <button type="button" onClick={() => setConfirmation({ action: "submit_order", name: selectedOrder.name, modified: selectedOrder.modified })} disabled={busy} className="rounded-lg bg-[#201b18] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Submit order</button>}{selectedOrder.docstatus === 1 && <button type="button" onClick={() => setConfirmation({ action: "create_invoice", name: selectedOrder.name, modified: selectedOrder.modified })} disabled={busy} className="rounded-lg bg-[#201b18] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Create draft invoice</button>}</div></div>}
      {area === "invoices" && selectedInvoice && !detailLoading && <div className="mt-7 rounded-xl bg-[#f7f5f2] p-5"><h3 className="text-lg font-semibold">Invoice {selectedInvoice.name}</h3><p className="mt-1 text-sm text-[#716b66]">{selectedInvoice.customer_name} · {selectedInvoice.status} · Due {selectedInvoice.due_date || "not set"}</p><div className="mt-4 divide-y divide-[#e5dfd8]">{selectedInvoice.items.map((item, index) => <div key={`${item.item_code}-${index}`} className="flex justify-between gap-3 py-2 text-sm"><span>{item.item_name || item.item_code} · {item.qty} × {money(item.rate)}</span><strong>{money(item.amount)}</strong></div>)}</div><p className="mt-3 text-right font-semibold">Total {money(selectedInvoice.grand_total)}</p>{selectedInvoice.docstatus === 0 && <button type="button" onClick={() => setConfirmation({ action: "submit_invoice", name: selectedInvoice.name, modified: selectedInvoice.modified })} disabled={busy} className="mt-5 rounded-lg bg-[#201b18] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Submit invoice</button>}</div>}
      {confirmation && <div className="mt-5 rounded-xl border border-[#c4a167] bg-[#fffaf1] p-4 text-sm"><p className="font-medium">{confirmation.action === "submit_invoice" ? "Submit this invoice to ERPNext accounting?" : confirmation.action === "submit_order" ? "Submit this sales order in ERPNext?" : "Create a draft invoice from this order?"}</p><p className="mt-1 text-[#716b66]">Check the customer, items, and totals before continuing.</p><div className="mt-3 flex gap-3"><button type="button" onClick={() => void performAction()} disabled={busy} className="rounded-lg bg-[#201b18] px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Working…" : "Confirm"}</button><button type="button" onClick={() => setConfirmation(null)} disabled={busy} className="rounded-lg border border-[#e5dfd8] px-4 py-2 disabled:opacity-50">Cancel</button></div></div>}
    </section>}
  </>;
}
