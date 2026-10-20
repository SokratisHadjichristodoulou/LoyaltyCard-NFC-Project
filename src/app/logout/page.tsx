import Link from "next/link";
import { getT } from "@/i18n/server";
import { Shell } from "@/components/Shell";
import { signOut } from "./actions";

// A page with a button rather than a GET link, so a stray link or prefetch
// can never sign someone out.
export default async function LogoutPage() {
  const t = await getT();
  return (
    <Shell t={t}>
      <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight">{t("logout.title")}</h1>
      <p className="mt-3 max-w-[34ch] text-roast">{t("logout.body")}</p>
      <form action={signOut} className="mt-8 grid gap-3">
        <button
          type="submit"
          className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-espresso px-7 text-base font-semibold text-gold-light ring-1 ring-gold/50 ring-inset active:scale-[0.98]"
        >
          {t("logout.confirm")}
        </button>
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line font-semibold text-roast">
          {t("logout.cancel")}
        </Link>
      </form>
    </Shell>
  );
}
