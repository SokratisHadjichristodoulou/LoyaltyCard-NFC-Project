"use client";

import Image from "next/image";
import { useEffect } from "react";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";
import { ErrorView } from "./ErrorView";

/** Body of error.tsx and global-error.tsx (client components, so no server i18n). */
export function ServerErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // The visitor's EL/EN choice, then the page's language, then the browser's.
  const fromCookie =
    typeof document !== "undefined"
      ? document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`))?.[1]
      : undefined;
  const fromPage = typeof document !== "undefined" ? document.documentElement.lang : undefined;
  const fromBrowser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : undefined;
  const locale = [fromCookie, fromPage, fromBrowser].find(isLocale) ?? "el";
  const t = createTranslator(locale);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <Image src="/logo.png" alt="Coffee Pause Cyprus" width={56} height={56} className="mx-auto rounded-full" />
      <ErrorView title={t("errors.server.title")} body={t("errors.server.body")} backLabel={t("errors.back")}>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 items-center rounded-full bg-espresso px-6 font-semibold text-gold-light ring-1 ring-gold/50 ring-inset"
        >
          {t("errors.server.retry")}
        </button>
      </ErrorView>
      {error.digest && (
        <p className="text-center font-mono text-xs text-muted select-all">{t("errors.server.reference", { id: error.digest })}</p>
      )}
    </main>
  );
}
