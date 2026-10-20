import Link from "next/link";
import { getT } from "@/i18n/server";
import { intlLocale, type Locale } from "@/i18n/config";
import { requireRole } from "@/lib/auth";
import { normaliseCode } from "@/lib/coupon-code";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { Shell } from "@/components/Shell";
import { QrScanner } from "@/components/staff/QrScanner";
import { RedeemButton } from "@/components/staff/RedeemButton";

type Props = { searchParams: Promise<{ code?: string; done?: string }> };
type FoundCoupon = Database["public"]["Functions"]["find_coupon_for_staff"]["Returns"][number];

const statusStyle = {
  valid: "bg-olive-soft text-olive ring-olive/30",
  used: "bg-line/50 text-roast ring-line",
  expired: "bg-berry-soft text-berry ring-berry/30",
} as const;

// Protected by src/proxy.ts (staff and admin) and checked again here.
export default async function StaffPage({ searchParams }: Props) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? normaliseCode(params.code) : "";
  await requireRole("staff", code ? `/staff?code=${encodeURIComponent(code)}` : "/staff");
  const t = await getT();

  let coupon: FoundCoupon | null = null;
  if (code) {
    // As the signed-in staff member: the lookup only finds their own cafe's coupons.
    const supabase = await createClient();
    const { data } = await supabase.rpc("find_coupon_for_staff", { p_code: code });
    coupon = data?.[0] ?? null;
  }

  const fmt = new Intl.DateTimeFormat(intlLocale[t.locale as Locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Nicosia",
  });
  const justRedeemed = params.done === "redeemed" && coupon?.status === "used";

  return (
    <Shell t={t}>
      <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight">{t("staff.title")}</h1>

      {!code && (
        <>
          <p className="mt-3 max-w-[36ch] text-roast">{t("staff.intro")}</p>
          <div className="mt-7">
            <QrScanner
              labels={{
                start: t("staff.startCamera"),
                stop: t("staff.stopCamera"),
                scanning: t("staff.scanning"),
                denied: t("staff.cameraDenied"),
                unsupported: t("staff.cameraUnsupported"),
              }}
            />
          </div>
        </>
      )}

      {code && !coupon && (
        <p role="alert" className="mt-6 rounded-2xl bg-berry-soft px-5 py-4 leading-relaxed text-berry">
          {t("staff.notFound", { code })}
        </p>
      )}

      {coupon && (
        <section aria-labelledby="coupon-status" className="mt-6 grid gap-5">
          {justRedeemed && (
            <p role="status" className="rise-in flex items-center gap-3 rounded-2xl bg-olive px-5 py-4 text-lg font-semibold text-paper">
              <svg aria-hidden viewBox="0 0 24 24" className="size-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
              {t("staff.results.redeemed")}
            </p>
          )}

          <div className={`rounded-[1.75rem] px-6 py-6 ring-1 ${statusStyle[coupon.status]}`}>
            <h2 id="coupon-status" className="font-display text-2xl font-medium">
              {t(`staff.status.${coupon.status}`)}
            </h2>
            <p className="mt-3 font-mono text-[clamp(1rem,4.6vw,1.3rem)] font-semibold tracking-[0.05em] whitespace-nowrap text-espresso">
              {coupon.code}
            </p>
            <p className="mt-2 text-sm">
              {coupon.status === "used" && coupon.redeemed_at
                ? t("staff.usedAt", { date: fmt.format(new Date(coupon.redeemed_at)) })
                : coupon.status === "expired"
                  ? t("staff.expiredOn", { date: fmt.format(new Date(coupon.expires_at)) })
                  : t("staff.expiresOn", { date: fmt.format(new Date(coupon.expires_at)) })}
            </p>
          </div>

          {coupon.status === "valid" && (
            <RedeemButton
              code={coupon.code}
              label={t("staff.redeem")}
              pendingLabel={t("staff.redeeming")}
              errorLabel={t("staff.results.error")}
            />
          )}
        </section>
      )}

      <form action="/staff" method="get" className="mt-8 grid gap-2 border-t border-line pt-6">
        <label htmlFor="code" className="text-sm font-semibold text-roast">
          {t("staff.manualLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            name="code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="CP-XXXX-XXXX-XXXX-XXXX"
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-foam px-4 font-mono text-base uppercase text-espresso placeholder:text-muted/60 focus:border-gold-ink focus:outline-none"
          />
          <button type="submit" className="min-h-12 shrink-0 rounded-2xl border border-espresso px-5 font-semibold">
            {t("staff.manualSubmit")}
          </button>
        </div>
      </form>

      {code && (
        <Link href="/staff" className="mt-6 inline-flex min-h-12 items-center rounded-full border border-espresso px-6 font-semibold">
          {t("staff.scanAnother")}
        </Link>
      )}
    </Shell>
  );
}
