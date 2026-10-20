import Link from "next/link";
import { getT } from "@/i18n/server";
import { getCard } from "@/lib/mock-data";
import { Shell } from "@/components/Shell";
import { StampCard } from "@/components/StampCard";
import { withState } from "@/components/href";

type Props = { searchParams: Promise<{ state?: string }> };

function greetingKey() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Nicosia" }).format(new Date()),
  );
  if (hour < 12) return "greeting.morning" as const;
  if (hour < 17) return "greeting.afternoon" as const;
  return "greeting.evening" as const;
}

export default async function HomePage({ searchParams }: Props) {
  const { state } = await searchParams;
  const t = await getT();
  const card = getCard(state);
  const complete = card.stamps >= 10 && card.coupon?.status === "valid";

  return (
    <Shell t={t} active="card" state={state}>
      <h1 className="mb-6 font-display text-[2.4rem] leading-[1.02] font-medium tracking-tight">
        {t(greetingKey())},
        <br />
        <span className="text-gold-ink italic">{card.customerName}.</span>
      </h1>

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
    </Shell>
  );
}
