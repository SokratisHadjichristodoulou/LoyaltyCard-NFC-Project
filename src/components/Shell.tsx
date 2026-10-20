import Image from "next/image";
import Link from "next/link";
import type { Translator } from "@/i18n/translate";
import type { Locale } from "@/i18n/config";
import { LangToggle } from "./LangToggle";
import { Footer } from "./Footer";
import { PreviewBar } from "./PreviewBar";
import { withState } from "./href";

type Page = "card" | "coupon" | "how";

const pages: { id: Page; path: string }[] = [
  { id: "card", path: "/" },
  { id: "coupon", path: "/coupon" },
  { id: "how", path: "/how-it-works" },
];

export function Shell({
  t,
  active,
  state,
  children,
}: {
  t: Translator;
  active: Page;
  state?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-clip px-4 sm:max-w-lg">
      <header className="flex items-center justify-between gap-4 pt-5 pb-3">
        <Link
          href={withState("/", state)}
          className="flex items-center gap-3 rounded-full"
          aria-label={t("header.logoAlt")}
        >
          <Image src="/logo.png" alt="" width={52} height={52} priority className="size-13 rounded-full" />
          <span className="font-display text-[1.05rem] leading-tight font-medium tracking-tight">
            Coffee Pause
            <span className="block text-[0.68rem] font-sans font-semibold tracking-[0.32em] text-caramel-ink uppercase">
              Cyprus
            </span>
          </span>
        </Link>
        <LangToggle locale={t.locale as Locale} label={t("header.languageLabel")} />
      </header>

      <nav aria-label={t("header.nav.label")} className="mt-2">
        <ul className="flex gap-1 border-b border-line">
          {pages.map((p) => {
            const current = p.id === active;
            return (
              <li key={p.id} className="flex-auto">
                <Link
                  href={withState(p.path, state)}
                  aria-current={current ? "page" : undefined}
                  className={`relative flex min-h-12 items-center justify-center px-1.5 text-center whitespace-nowrap text-[0.8rem] leading-tight font-medium min-[360px]:text-[0.9rem] transition-colors ${
                    current ? "text-espresso" : "text-muted hover:text-espresso"
                  }`}
                >
                  {t(`header.nav.${p.id}`)}
                  <span
                    aria-hidden
                    className={`absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-caramel transition-opacity ${
                      current ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id="main" className="flex-1 pt-7 pb-12">
        {children}
      </main>

      <Footer t={t} />
      <PreviewBar t={t} active={active} state={state} />
    </div>
  );
}
