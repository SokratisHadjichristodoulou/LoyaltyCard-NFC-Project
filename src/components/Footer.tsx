import type { Translator } from "@/i18n/translate";

const INSTAGRAM_URL = "https://www.instagram.com/coffeepausecyprus/";

export function Footer({ t }: { t: Translator }) {
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
    </footer>
  );
}
