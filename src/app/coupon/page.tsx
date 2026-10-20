import Link from "next/link";
import { getT } from "@/i18n/server";
import { getCardView } from "@/lib/card-data";
import { Shell } from "@/components/Shell";
import { Coupon } from "@/components/Coupon";
import { CupGlyph } from "@/components/Stamp";
import { withState } from "@/components/href";
import { Celebration } from "@/components/Celebration";
import { couponQrSvg } from "@/lib/coupons";

type Props = { searchParams: Promise<{ state?: string; new?: string }> };

export default async function CouponPage({ searchParams }: Props) {
  const t = await getT();
  const params = await searchParams;
  const { card, state } = await getCardView(params.state, "/coupon");
  const justIssued = params.new === "1" && card.coupon?.status === "valid";

  return (
    <Shell t={t} active="coupon" state={state}>
      {card.coupon ? (
        <div className="relative">
          {justIssued && (
            <p role="status" className="rise-in mb-5 text-center font-display text-3xl font-medium text-gold-ink">{t("coupon.newTitle")}</p>
          )}
          <Coupon coupon={card.coupon} qrSvg={await couponQrSvg(card.coupon.code)} t={t} />
          {justIssued && <Celebration />}
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-line px-6 py-10 text-center">
          <CupGlyph className="mx-auto size-14 text-gold" />
          <h1 className="mt-4 font-display text-3xl font-medium">{t("coupon.emptyTitle")}</h1>
          <p className="mx-auto mt-2 max-w-[28ch] text-roast">
            {t.plural("coupon.emptyBody", { count: Math.max(card.goal - card.stamps, 0) })}
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
