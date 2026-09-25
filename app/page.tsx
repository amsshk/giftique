"use client";

import { ArrowUpRight, ClipboardList, FileText, Package, Truck, Users } from "lucide-react";
import AuthGate from "./auth-gate";

const deskUrl = (process.env.NEXT_PUBLIC_PROXC_DESK_URL || "http://84.235.254.131:8080").replace(/\/$/, "");
const giftiqueWorkspace = `${deskUrl}/desk/giftique`;

const areas = [
  { title: "Orders", description: "Review and process customer orders.", icon: ClipboardList },
  { title: "Customers", description: "Keep customer and contact details up to date.", icon: Users },
  { title: "Invoices", description: "Prepare and submit sales invoices.", icon: FileText },
  { title: "Products & stock", description: "View products, prices, and warehouse information.", icon: Package },
  { title: "Delivery", description: "Prepare and submit delivery notes.", icon: Truck },
];

function ManagementHome() {
  return (
    <main className="min-h-screen bg-[#f7f5f2] px-6 py-10 text-[#201b18]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#8b6f47]">Giftique Atelier</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Management</h1>
            <p className="mt-2 text-[#716b66]">Powered by PROXC</p>
          </div>
          <a href={giftiqueWorkspace} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#201b18] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90">
            Open Giftique workspace <ArrowUpRight size={16} />
          </a>
        </header>

        <section className="mb-8 rounded-2xl border border-[#e5dfd8] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-semibold">Your Giftique workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#716b66]">
            Manage daily sales and deliveries in one place. The workspace opens with your Giftique account and shows the tools available to your role.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Giftique operations">
          {areas.map(({ title, description, icon: Icon }) => (
            <a key={title} href={giftiqueWorkspace} target="_blank" rel="noopener noreferrer"
              className="group rounded-2xl border border-[#e5dfd8] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1ece5]"><Icon size={21} /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-5 text-[#716b66]">{description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
                Open Giftique workspace <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}

export default function App() {
  return <AuthGate><ManagementHome /></AuthGate>;
}
