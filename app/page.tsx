"use client";

import { ExternalLink, Package, ShoppingCart, Users, Warehouse, Receipt, CreditCard, BarChart3 } from "lucide-react";

const ERPNext_URL = "http://84.235.254.131:8080";

const links = [
  {
    title: "Sales Orders",
    description: "View and manage Giftique customer orders.",
    icon: ShoppingCart,
    path: "/app/sales-order",
  },
  {
    title: "Customers",
    description: "Manage customers and customer information.",
    icon: Users,
    path: "/app/customer",
  },
  {
    title: "Items",
    description: "Manage Giftique products and pricing.",
    icon: Package,
    path: "/app/item",
  },
  {
    title: "Inventory",
    description: "View stock and warehouse inventory.",
    icon: Warehouse,
    path: "/app/stock-balance",
  },
  {
    title: "Invoices",
    description: "Manage sales invoices and billing.",
    icon: Receipt,
    path: "/app/sales-invoice",
  },
  {
    title: "Payments",
    description: "Manage payment entries and received payments.",
    icon: CreditCard,
    path: "/app/payment-entry",
  },
  {
    title: "Reports",
    description: "Open ERPNext accounting and business reports.",
    icon: BarChart3,
    path: "/app/query-report",
  },
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#f7f5f2] px-6 py-10 text-[#201b18]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#8b6f47]">
              Giftique Atelier
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Management
            </h1>
            <p className="mt-2 text-[#716b66]">
              Powered by PROXC and ERPNext
            </p>
          </div>

          <a
            href={ERPNext_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#201b18] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Open ERPNext
            <ExternalLink size={16} />
          </a>
        </header>

        <section className="mb-8 rounded-2xl border border-[#e5dfd8] bg-white p-7 shadow-sm">
          <h2 className="text-xl font-semibold">ERPNext Management</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#716b66]">
            Your accounting, inventory, customers, orders and payments are
            managed directly in ERPNext. PROXC connects the Giftique
            storefront to the ERP system.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon;

            return (
              <a
                key={link.title}
                href={`${ERPNext_URL}${link.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-[#e5dfd8] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1ece5]">
                  <Icon size={21} />
                </div>

                <h3 className="font-semibold">{link.title}</h3>

                <p className="mt-2 text-sm leading-5 text-[#716b66]">
                  {link.description}
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-medium">
                  Open in ERPNext
                  <ExternalLink
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </a>
            );
          })}
        </section>
      </div>
    </main>
  );
}
