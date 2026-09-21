import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giftique Ledger",
  description: "Accounting and profit management for Giftique Atelier.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header style={{ padding: "20px" }}>
          <Image
            src="/logo.svg"
            alt="Giftique Logo"
            width={120}
            height={120}
          />
        </header>

        {children}
      </body>
    </html>
  );
}
