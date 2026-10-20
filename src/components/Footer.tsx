import Link from "next/link";
import type { Translator } from "@/i18n/translate";

const INSTAGRAM_URL = "https://www.instagram.com/coffeepausecyprus/";

export function Footer({ t, signedIn = false }: { t: Translator; signedIn?: boolean }) {
  return (
    <footer className="flex flex-col items-center gap-3 border-t border-line py-7 text-center">
      <p className="font-display text-lg italic">{t("footer.name")}</p>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-roast underline-offset-4 hover:text-espresso hover:underline"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
        </svg>
        <span>
          {t("footer.instagram")}
          <span className="sr-only"> (@coffeepausecyprus)</span>
        </span>
      </a>
      <nav aria-label={t("footer.name")} className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-muted">
        <Link href="/privacy" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium underline-offset-4 hover:text-espresso hover:underline">
          {t("footer.privacy")}
        </Link>
        {signedIn && (
          <>
            <Link href="/account" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium underline-offset-4 hover:text-espresso hover:underline">
              {t("footer.account")}
            </Link>
            <Link href="/logout" className="inline-flex min-h-11 items-center rounded-full px-3 font-medium underline-offset-4 hover:text-espresso hover:underline">
              {t("header.signOut")}
            </Link>
          </>
        )}
      </nav>
    </footer>
  );
}
