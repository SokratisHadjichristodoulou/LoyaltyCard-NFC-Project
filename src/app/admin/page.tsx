import { getT } from "@/i18n/server";
import { intlLocale, type Locale } from "@/i18n/config";
import { loadOverview } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { AdminHeader } from "@/components/admin/AdminNav";
import { StatTile } from "@/components/admin/StatTile";
import { StampsChart } from "@/components/admin/StampsChart";

// Protected by src/proxy.ts (admins) and checked again in loadOverview().
export default async function AdminOverviewPage() {
  const { stats, activity } = await loadOverview();
  const t = await getT();
  const locale = intlLocale[t.locale as Locale];
  const num = new Intl.NumberFormat(locale);
  const when = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Nicosia",
  });

  return (
    <Shell t={t} wide>
      <AdminHeader t={t} active="overview" title={t("admin.nav.overview")} />

      {stats && (
        <div className="mt-6 grid gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t("admin.kpi.customers")} value={num.format(stats.customers)} />
            <StatTile label={t("admin.kpi.stampsToday")} value={num.format(stats.stamps_today)} />
            <StatTile label={t("admin.kpi.stamps7d")} value={num.format(stats.stamps_7d)} />
            <StatTile
              label={t("admin.kpi.couponsRedeemed")}
              value={num.format(stats.coupons_redeemed)}
              note={t("admin.kpi.couponsIssued", { count: num.format(stats.coupons_issued) })}
            />
          </div>

          <StampsChart t={t} days={stats.daily} />

          <section aria-labelledby="activity-title">
            <h2 id="activity-title" className="font-display text-xl font-medium">{t("admin.activity.title")}</h2>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("admin.activity.empty")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-foam/60">
                {activity.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.kind === "redeemed" ? "bg-olive-soft text-olive" : a.kind === "coupon_issued" ? "bg-gold/25 text-gold-ink" : "bg-line/60 text-roast"
                      }`}
                    >
                      {t(`admin.activity.${a.kind}`)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{a.email}</span>
                    <time dateTime={a.at} className="text-xs text-muted tabular">
                      {when.format(new Date(a.at))}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
