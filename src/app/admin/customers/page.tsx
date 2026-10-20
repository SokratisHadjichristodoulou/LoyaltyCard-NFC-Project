import { getT } from "@/i18n/server";
import { intlLocale, type Locale } from "@/i18n/config";
import { loadCustomers } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { AdminHeader } from "@/components/admin/AdminNav";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminCustomersPage({ searchParams }: Props) {
  const q = (await searchParams).q?.slice(0, 100) ?? "";
  const customers = await loadCustomers(q);
  const t = await getT();
  const date = new Intl.DateTimeFormat(intlLocale[t.locale as Locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Nicosia",
  });

  return (
    <Shell t={t} wide>
      <AdminHeader t={t} active="customers" title={t("admin.customers.title")} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <form method="get" className="flex min-w-0 flex-1 gap-2">
          <label htmlFor="q" className="sr-only">{t("admin.customers.search")}</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("admin.customers.search")}
            className="min-h-12 min-w-0 flex-1 rounded-2xl border border-line bg-foam px-4 text-base text-espresso placeholder:text-muted/70 focus:border-gold-ink focus:outline-none"
          />
          <button type="submit" className="min-h-12 shrink-0 rounded-2xl border border-espresso px-4 font-semibold">
            {t("admin.customers.searchSubmit")}
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-muted">{t("admin.customers.export")}:</span>
          <a href="/api/export?type=customers" className="inline-flex min-h-11 items-center rounded-full bg-foam px-4 font-semibold text-roast ring-1 ring-line">
            {t("admin.customers.exportCustomers")}
          </a>
          <a href="/api/export?type=stamps" className="inline-flex min-h-11 items-center rounded-full bg-foam px-4 font-semibold text-roast ring-1 ring-line">
            {t("admin.customers.exportStamps")}
          </a>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted" role="status">
        {t.plural("admin.customers.count", { count: customers.length })}
      </p>

      {customers.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">{t("admin.customers.empty")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm tabular">
            <thead className="bg-foam text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t("admin.customers.email")}</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t("admin.customers.name")}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("admin.customers.card")}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("admin.customers.lifetime")}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("admin.customers.coupons")}</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t("admin.customers.lastStamp")}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customer_id} className="border-t border-line/70 bg-paper/60">
                  <th scope="row" className="max-w-[16rem] truncate px-3 py-2.5 font-medium">{c.email}</th>
                  <td className="px-3 py-2.5 text-roast">{c.display_name ?? "–"}</td>
                  <td className="px-3 py-2.5 text-right">{c.stamp_count}</td>
                  <td className="px-3 py-2.5 text-right">{c.stamps_total}</td>
                  <td className="px-3 py-2.5 text-right">
                    {c.coupons_valid} / {c.coupons_used}
                  </td>
                  <td className="px-3 py-2.5 text-roast">
                    {c.last_stamp_at ? date.format(new Date(c.last_stamp_at)) : t("admin.customers.never")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
