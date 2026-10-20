import Link from "next/link";
import { getT } from "@/i18n/server";
import { Shell } from "@/components/Shell";

export default async function NotAllowedPage() {
  const t = await getT();
  return (
    <Shell t={t}>
      <div className="rounded-[1.75rem] border border-dashed border-line px-6 py-10 text-center">
        <span aria-hidden className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-berry font-display text-2xl text-berry">
          !
        </span>
        <h1 className="mt-4 font-display text-3xl font-medium">{t("notAllowed.title")}</h1>
        <p className="mx-auto mt-2 max-w-[32ch] leading-relaxed text-roast">{t("notAllowed.body")}</p>
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-full border border-espresso px-6 font-semibold">
          {t("notAllowed.back")}
        </Link>
      </div>
    </Shell>
  );
}
