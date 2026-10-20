import type { Translator } from "@/i18n/translate";
import { intlLocale, type Locale } from "@/i18n/config";
import type { Coupon as CouponData } from "@/lib/card";
import { PlaceholderQR } from "./PlaceholderQR";
import { CupGlyph } from "./Stamp";

const statusStyle = {
  valid: "bg-olive-soft text-olive",
  used: "bg-line/60 text-roast",
  expired: "bg-berry-soft text-berry",
} as const;

export function Coupon({ coupon, t }: { coupon: CouponData; t: Translator }) {
  const fmt = new Intl.DateTimeFormat(intlLocale[t.locale as Locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Nicosia",
  });
  const inactive = coupon.status !== "valid";

  return (
    <article aria-labelledby="coupon-title" className="relative">
      {/* Top half: the offer */}
      <div className="relative overflow-hidden rounded-t-[1.75rem] bg-espresso px-6 pt-6 pb-8 text-crema">
        {/* Thin gold frame, echoing the ring around the logo */}
        <span aria-hidden className="absolute inset-x-2.5 top-2.5 -bottom-px rounded-t-[1.35rem] border border-b-0 border-gold/40" />
        <span aria-hidden className="steam absolute top-5 right-6 text-gold">
          <svg viewBox="0 0 40 30" className="h-8 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M10 26c-4-5 4-8 0-14" />
            <path d="M20 26c-4-5 4-8 0-14" />
            <path d="M30 26c-4-5 4-8 0-14" />
          </svg>
        </span>
        <p className="text-[0.7rem] font-semibold tracking-[0.28em] text-gold uppercase">{t("coupon.eyebrow")}</p>
        <h1 id="coupon-title" className="mt-2 font-display text-[2.75rem] leading-[0.95] font-semibold text-gold-light italic">
          {t("coupon.title")}
        </h1>
        <p className="mt-3 max-w-[26ch] text-[0.95rem] leading-relaxed text-crema/80">{t("coupon.subtitle")}</p>
      </div>

      {/* Perforated tear line */}
      <div aria-hidden className="relative h-0">
        <span className="absolute -top-3 -left-3 size-6 rounded-full bg-paper" />
        <span className="absolute -top-3 -right-3 size-6 rounded-full bg-paper" />
        <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-paper/70" />
      </div>

      {/* Bottom half: the proof */}
      <div className="rounded-b-[1.75rem] border border-t-0 border-line bg-crema px-6 pt-7 pb-6 shadow-[0_18px_40px_-24px_rgb(58_22_9/0.45)]">
        <div className="relative mx-auto w-fit">
          <div className={`rounded-2xl bg-white p-3 shadow-sm ring-1 ring-line ${inactive ? "opacity-35 grayscale" : ""}`}>
            <PlaceholderQR
              code={coupon.code}
              label={t("coupon.qrAlt", { code: coupon.code })}
              className="size-48 text-espresso"
            />
          </div>
          {inactive && (
            <span
              aria-hidden
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-lg border-[3px] px-3 py-1 font-display text-2xl font-semibold tracking-wider uppercase ${
                coupon.status === "used" ? "border-roast text-roast" : "border-berry text-berry"
              }`}
            >
              {t(`coupon.status.${coupon.status}`)}
            </span>
          )}
          <p className="mt-2 text-center text-[0.65rem] font-semibold tracking-[0.2em] text-muted uppercase">
            {t("coupon.qrPlaceholder")}
          </p>
        </div>

        <p className="mt-5 text-center text-[0.7rem] font-semibold tracking-[0.24em] text-muted uppercase">
          {t("coupon.codeLabel")}
        </p>
        <p className="mt-1 text-center font-mono text-[clamp(1rem,4.6vw,1.4rem)] font-semibold tracking-[0.05em] whitespace-nowrap tabular select-all">
          {coupon.code}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5">
          <div>
            <dt className="text-[0.7rem] font-semibold tracking-[0.2em] text-muted uppercase">
              {coupon.status === "used" ? t("coupon.usedOnLabel") : t("coupon.expiresLabel")}
            </dt>
            <dd className="mt-1 font-medium">
              <time dateTime={coupon.status === "used" ? coupon.usedAt : coupon.expiresAt}>
                {fmt.format(new Date(coupon.status === "used" && coupon.usedAt ? coupon.usedAt : coupon.expiresAt))}
              </time>
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-[0.7rem] font-semibold tracking-[0.2em] text-muted uppercase">{t("coupon.statusLabel")}</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${statusStyle[coupon.status]}`}>
                <span aria-hidden className="size-2 rounded-full bg-current" />
                {t(`coupon.status.${coupon.status}`)}
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-5 flex gap-2.5 rounded-xl bg-foam px-4 py-3 text-sm leading-relaxed text-roast">
          <CupGlyph className="mt-0.5 size-5 shrink-0 text-gold-ink" />
          {coupon.status === "valid"
            ? t("coupon.showStaff")
            : coupon.status === "used"
              ? t("coupon.usedNote")
              : t("coupon.expiredNote")}
        </p>
      </div>
    </article>
  );
}
