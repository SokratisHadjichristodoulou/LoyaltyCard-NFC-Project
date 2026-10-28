import Link from "next/link";
import { getT } from "@/i18n/server";
import { getCardView } from "@/lib/card-data";
import { Shell } from "@/components/Shell";
import { StampCard } from "@/components/StampCard";
import { withState } from "@/components/href";
import { addTestStamp } from "@/app/actions/dev-stamp";
import { isDevStampEnabled } from "@/lib/env";

type Props = { searchParams: Promise<{ state?: string; stamped?: string; cooldown?: string; daily?: string }> };

function greetingKey() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Nicosia" }).format(new Date()),
  );
  if (hour >= 5 && hour < 12) return "greeting.morning" as const;
  if (hour >= 12 && hour < 17) return "greeting.afternoon" as const;
  return "greeting.evening" as const;
}

export default async function HomePage({ searchParams }: Props) {
  const t = await getT();
  const params = await searchParams;
  const { card, state, source } = await getCardView(params.state, "/", { justStamped: params.stamped === "1" });
  const hasCoupon = card.coupon?.status === "valid";
  const complete = card.stamps >= card.goal && hasCoupon;
  const cooldownSeconds = Number(params.cooldown);
  const cooldownMinutes = Number.isFinite(cooldownSeconds) && cooldownSeconds > 0 ? Math.ceil(cooldownSeconds / 60) : 0;

  return (
    <Shell t={t} active="card" state={state}>
      <h1 className="mb-6 font-display text-[2.4rem] leading-[1.02] font-medium tracking-tight">
        {card.customerName ? (
          <>
            {t(greetingKey())},
            <br />
            <span className="text-gold-ink italic">{card.customerName}.</span>
          </>
        ) : (
          <>{t(greetingKey())}!</>
        )}
      </h1>

      {cooldownMinutes > 0 && (
        <p role="status" className="mb-5 rounded-xl bg-foam px-4 py-3 text-sm leading-relaxed text-roast ring-1 ring-line">
          {t.plural("stamp.cooldown", { count: cooldownMinutes })}
        </p>
      )}

      {params.daily === "1" && (
        <p role="status" className="mb-5 rounded-xl bg-foam px-4 py-3 text-sm leading-relaxed text-roast ring-1 ring-line">
          {t("stamp.daily")}
        </p>
      )}

      {hasCoupon && !complete && (
        <Link
          href={withState("/coupon", state)}
          className="mb-5 flex items-center gap-4 rounded-[1.5rem] bg-espresso px-5 py-4 text-crema ring-1 ring-gold/50 ring-inset"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl font-medium text-gold-light">{t("couponReady.title")}</span>
            <span className="mt-0.5 block text-sm text-crema/80">{t("couponReady.body")}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-gold-light">
            {t("couponReady.cta")} <span aria-hidden>→</span>
          </span>
        </Link>
      )}

      <StampCard card={card} t={t} />

      {complete && (
        <div className="rise-in mt-7 text-center" style={{ ["--delay" as string]: "1300ms" }}>
          <h2 className="font-display text-2xl font-medium">{t("complete.title")}</h2>
          <p className="mt-1 text-roast">{t("complete.body")}</p>
          <Link
            href={withState("/coupon", state)}
            className="mt-5 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-espresso px-7 text-base font-semibold text-gold-light ring-1 ring-gold/50 ring-inset shadow-[0_10px_24px_-12px_rgb(58_22_9/0.7)] transition-transform active:scale-[0.98]"
          >
            {t("complete.cta")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      )}
      {source === "db" && isDevStampEnabled() && (
        <form action={addTestStamp} className="mt-8 rounded-2xl border border-dashed border-line px-4 py-3">
          <p className="mb-2 text-[0.7rem] font-semibold tracking-[0.2em] text-muted uppercase">{t("dev.label")}</p>
          <button type="submit" className="min-h-11 rounded-full bg-foam px-4 text-sm font-semibold text-roast ring-1 ring-line">
            {t("dev.stamp")}
          </button>
        </form>
      )}
    </Shell>
  );
}
