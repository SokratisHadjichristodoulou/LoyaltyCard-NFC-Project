import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import el from "@/i18n/el.json";

export const metadata: Metadata = {
  title: el.meta.title,
  description: el.meta.description,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
