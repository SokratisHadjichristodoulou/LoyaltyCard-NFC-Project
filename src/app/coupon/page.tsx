import Link from "next/link";
import { getT } from "@/i18n/server";
import { STAMP_GOAL, getCard } from "@/lib/mock-data";
import { Shell } from "@/components/Shell";
import { Coupon } from "@/components/Coupon";
import { CupGlyph } from "@/components/Stamp";
import { withState } from "@/components/href";

type Props = { searchParams: Promise<{ state?: string }> };

export default async function CouponPage({ searchParams }: Props) {
  const { state } = await searchParams;
  const t = await getT();
  const card = getCard(state);

  return (
    <Shell t={t} active="coupon" state={state}>
      {card.coupon ? (
        <Coupon coupon={card.coupon} t={t} />
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-line px-6 py-10 text-center">
          <CupGlyph className="mx-auto size-14 text-gold" />
          <h1 className="mt-4 font-display text-3xl font-medium">{t("coupon.emptyTitle")}</h1>
          <p className="mx-auto mt-2 max-w-[28ch] text-roast">
            {t.plural("coupon.emptyBody", { count: STAMP_GOAL - card.stamps })}
          </p>
          <Link
            href={withState("/", state)}
            className="mt-6 inline-flex min-h-12 items-center rounded-full border border-espresso px-6 font-semibold"
          >
            {t("coupon.backToCard")}
          </Link>
        </div>
      )}
    </Shell>
  );
}
