import Link from "next/link";
import { getT } from "@/i18n/server";
import { intlLocale, type Locale } from "@/i18n/config";
import { cafeInfo } from "@/lib/cafe-info";
import { Shell } from "@/components/Shell";

export default async function PrivacyPage() {
  const t = await getT();
  const m = t.messages.privacy;
  const fill = (value: string) => value || m.missing;
  const updated = new Intl.DateTimeFormat(intlLocale[t.locale as Locale], { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${cafeInfo.lastUpdated}T00:00:00Z`),
  );
  const section = "grid gap-2";
  const heading = "font-display text-xl font-medium";

  return (
    <Shell t={t}>
      <article className="grid max-w-[65ch] gap-7 leading-relaxed text-roast">
        <header>
          <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight text-espresso">{m.title}</h1>
          <p className="mt-3">{m.intro}</p>
          <p className="mt-1 text-sm text-muted">{t("privacy.lastUpdated", { date: updated })}</p>
        </header>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.who.title}</h2>
          <p>
            {t("privacy.who.body", {
              name: fill(cafeInfo.legalName),
              address: fill(cafeInfo.address),
              email: fill(cafeInfo.email),
            })}
          </p>
        </section>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.what.title}</h2>
          <ul className="grid list-disc gap-1 pl-5 marker:text-gold">
            {m.what.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{m.what.none}</p>
        </section>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.why.title}</h2>
          <p>{m.why.body}</p>
        </section>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.cookies.title}</h2>
          <p>{m.cookies.body}</p>
          <ul className="grid gap-1 pl-5 text-sm">
            {m.cookies.items.map((item) => {
              const [name, ...rest] = item.split(":");
              return (
                <li key={item} className="list-disc marker:text-gold">
                  <code className="font-mono text-espresso">{name}</code>:{rest.join(":")}
                </li>
              );
            })}
          </ul>
        </section>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.who_sees.title}</h2>
          <p>{m.who_sees.body}</p>
        </section>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.how_long.title}</h2>
          <p>{m.how_long.body}</p>
        </section>

        <section className={section}>
          <h2 className={`${heading} text-espresso`}>{m.rights.title}</h2>
          <p>{m.rights.body}</p>
          <p>
            <a href="https://www.dataprotection.gov.cy" target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-ink underline underline-offset-4">
              {m.rights.authority}
            </a>
          </p>
          <Link href="/account" className="mt-2 inline-flex min-h-12 w-fit items-center rounded-full border border-espresso px-6 font-semibold text-espresso">
            {m.rights.account}
          </Link>
        </section>
      </article>
    </Shell>
  );
}
