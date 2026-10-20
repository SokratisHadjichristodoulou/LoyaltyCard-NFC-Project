import type { Metadata, Viewport } from "next";
import { Commissioner, Piazzolla } from "next/font/google";
import "@/styles/globals.css";
import { getLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/translate";

const piazzolla = Piazzolla({
  subsets: ["latin", "greek"],
  style: ["normal", "italic"],
  variable: "--font-piazzolla",
  display: "swap",
});

const commissioner = Commissioner({
  subsets: ["latin", "greek"],
  variable: "--font-commissioner",
  display: "swap",
});

const noIndex = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
};

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getLocale());
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    robots: noIndex,
    icons: { icon: "/logo.png", apple: "/logo.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf7f0",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${piazzolla.variable} ${commissioner.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
