"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, FileText, Package, RefreshCw, Truck, Users } from "lucide-react";
import AuthGate from "./auth-gate";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const areas = [
  { title: "Orders", description: "Customer orders and their progress.", icon: ClipboardList },
  { title: "Customers", description: "Customer and contact details.", icon: Users },
  { title: "Invoices", description: "Sales invoices and payment status.", icon: FileText },
  { title: "Products & stock", description: "Products, prices, and warehouse stock.", icon: Package },
  { title: "Delivery", description: "Delivery notes and shipment progress.", icon: Truck },
];

type Overview = {
  company: string;
  currency: string;
  counts: { orders: number; draft_orders: number; invoices: number };
  orders: { name: string; customer_name: string; transaction_date: string; grand_total: number; status: string }[];
  invoices: { name: string; customer_name: string; posting_date: string; grand_total: number; outstanding_amount: number; status: string }[];
  stock: { item_code: string; actual_qty: number; reserved_qty: number; projected_qty: number }[];
};

const money = (amount: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(amount);

function LiveOverview() {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again to refresh the overview.");
      const response = await fetch("/api/proxc-management", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const data = await response.json() as { message?: Overview; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "Overview unavailable.");
      setOverview(data.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Overview unavailable.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <section className="mb-8 rounded-2xl border border-[#e5dfd8] bg-white p-7 shadow-sm" aria-label="Live Giftique overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6f47]">Live from PROXC</p><h2 className="mt-1 text-xl font-semibold">Business overview</h2></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[#e5dfd8] px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
      </div>
      {loading && !overview ? <p className="mt-5 text-sm text-[#716b66]">Loading Giftique data…</p> : null}
      {error ? <p role="alert" className="mt-5 text-sm text-[#a33737]">{error}</p> : null}
      {overview ? <>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {([
            ["Sales orders", overview.counts.orders],
            ["Draft orders", overview.counts.draft_orders],
            ["Sales invoices", overview.counts.invoices],
          ] as const).map(([label, value]) => <div key={label} className="rounded-xl bg-[#f7f5f2] p-4"><p className="text-sm text-[#716b66]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
        </div>
        <div className="mt-7 grid gap-7 lg:grid-cols-2">
          <div><h3 className="font-semibold">Recent orders</h3><div className="mt-3 divide-y divide-[#eee9e3]">
            {overview.orders.length ? overview.orders.map(order => <div key={order.name} className="flex justify-between gap-4 py-3 text-sm"><div><strong>{order.name}</strong><p className="text-[#716b66]">{order.customer_name} · {order.status}</p></div><span className="whitespace-nowrap">{money(order.grand_total)}</span></div>) : <p className="py-3 text-sm text-[#716b66]">No Giftique orders yet.</p>}
          </div></div>
          <div><h3 className="font-semibold">Recent invoices</h3><div className="mt-3 divide-y divide-[#eee9e3]">
            {overview.invoices.length ? overview.invoices.map(invoice => <div key={invoice.name} className="flex justify-between gap-4 py-3 text-sm"><div><strong>{invoice.name}</strong><p className="text-[#716b66]">{invoice.customer_name} · {invoice.status}</p></div><span className="whitespace-nowrap">{money(invoice.grand_total)}</span></div>) : <p className="py-3 text-sm text-[#716b66]">No Giftique invoices yet.</p>}
          </div></div>
        </div>
        <h3 className="mt-7 font-semibold">Finished goods stock</h3>
        <div className="mt-3 flex flex-wrap gap-2">{overview.stock.length ? overview.stock.map(item => <span key={item.item_code} className="rounded-lg bg-[#f7f5f2] px-3 py-2 text-sm">{item.item_code} <strong className="ml-2">{item.actual_qty}</strong></span>) : <p className="text-sm text-[#716b66]">No Giftique stock in this warehouse.</p>}</div>
      </> : null}
    </section>
  );
}

function ManagementHome() {
  return (
    <main className="min-h-screen bg-[#f7f5f2] px-6 py-10 text-[#201b18]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#8b6f47]">Giftique Atelier</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Management</h1>
            <p className="mt-2 text-[#716b66]">Powered by PROXC</p>
          </div>
        </header>

        <section className="mb-8 rounded-2xl border border-[#e5dfd8] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-semibold">Your Giftique management area</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#716b66]">
            Review live business information from ERPNext below. More management tools will appear here as they are connected through PROXC.
          </p>
        </section>

        <LiveOverview />

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Giftique operations">
          {areas.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-[#e5dfd8] bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1ece5]"><Icon size={21} /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-5 text-[#716b66]">{description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

export default function App() {
  return <AuthGate><ManagementHome /></AuthGate>;
}
