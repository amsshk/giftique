import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giftique Atelier",
  description:
    "Thoughtfully selected gifts and keepsakes from Giftique Atelier.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
