"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, type Locale } from "@/i18n/config";
import { setLanguage } from "@/i18n/actions";

const short: Record<Locale, string> = { el: "EL", en: "EN" };
const native: Record<Locale, string> = { el: "Ελληνικά", en: "English" };

export function LangToggle({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLanguage(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending}
      className="relative grid grid-cols-2 rounded-full border border-line bg-foam p-1 text-sm font-semibold tracking-wide"
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-espresso transition-transform duration-300 ease-out ${
          locale === "en" ? "translate-x-full" : ""
        }`}
      />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          aria-label={native[l]}
          onClick={() => choose(l)}
          className={`relative z-10 min-h-11 min-w-12 rounded-full px-3 transition-colors duration-300 ${
            l === locale ? "text-paper" : "text-roast hover:text-espresso"
          }`}
        >
          {short[l]}
        </button>
      ))}
    </div>
  );
}
