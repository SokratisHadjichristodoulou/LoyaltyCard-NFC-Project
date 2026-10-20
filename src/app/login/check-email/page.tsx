import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/i18n/server";
import { Shell } from "@/components/Shell";
import { CupGlyph } from "@/components/Stamp";
import { LOGIN_EMAIL_COOKIE } from "../constants";

export default async function CheckEmailPage() {
  const t = await getT();
  const email = (await cookies()).get(LOGIN_EMAIL_COOKIE)?.value;

  return (
    <Shell t={t}>
      <div className="rounded-[1.75rem] border border-line bg-crema px-6 py-9 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-espresso text-gold-light ring-2 ring-gold/45 ring-offset-2 ring-offset-crema">
          <svg aria-hidden viewBox="0 0 40 40" className="size-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="9" width="30" height="22" rx="3" />
            <path d="m6 11 14 10 14-10" />
          </svg>
        </span>
        <h1 className="mt-5 font-display text-3xl font-medium">{t("checkEmail.title")}</h1>
        <p className="mx-auto mt-3 max-w-[32ch] leading-relaxed text-roast">
          {email ? t("checkEmail.body", { email }) : t("checkEmail.bodyNoEmail")}
        </p>
      </div>

      <ul className="mt-6 grid gap-2 text-sm text-roast">
        {(["checkEmail.tipSpam", "checkEmail.tipExpiry"] as const).map((key) => (
          <li key={key} className="flex gap-2.5">
            <CupGlyph className="mt-0.5 size-4 shrink-0 text-gold-ink" />
            {t(key)}
          </li>
        ))}
      </ul>

      <Link
        href="/login"
        className="mt-8 inline-flex min-h-12 items-center rounded-full border border-espresso px-6 font-semibold"
      >
        {t("checkEmail.retry")}
      </Link>
    </Shell>
  );
}
