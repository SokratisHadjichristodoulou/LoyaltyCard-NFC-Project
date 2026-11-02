import { getT } from "@/i18n/server";
import { intlLocale, type Locale } from "@/i18n/config";
import { loadWalletAdmin } from "@/lib/admin";
import type { WalletThemeRow } from "@/lib/supabase/types";
import { themePresets } from "@/lib/wallet/presets";
import { activeTheme, cyprusToday, heroImageUrl } from "@/lib/wallet/themes";
import { Shell } from "@/components/Shell";
import { AdminHeader } from "@/components/admin/AdminNav";
import { ThemeForm } from "@/components/admin/ThemeForm";
import { WalletSyncForm } from "@/components/admin/WalletSyncForm";
import { WalletPreview } from "@/components/wallet/WalletPreview";
import { deleteWalletTheme, setWalletThemeActive } from "../actions";

export default async function AdminWalletPage() {
  const { cafe, themes, status } = await loadWalletAdmin();
  const t = await getT();
  const m = t.messages.admin.wallet;
  const today = cyprusToday();
  const current = activeTheme(themes, today);

  // Theme dates are calendar days: format them as such, without a time zone shift.
  const locale = intlLocale[t.locale as Locale];
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const full = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const range = (row: WalletThemeRow) => {
    const format = row.repeats_yearly ? dayMonth : full;
    const text = t("admin.wallet.range", {
      from: format.format(new Date(`${row.starts_on}T12:00:00Z`)),
      to: format.format(new Date(`${row.ends_on}T12:00:00Z`)),
    });
    return row.repeats_yearly ? `${text}, ${t("admin.wallet.everyYear")}` : text;
  };

  const preview = {
    cafeName: cafe.name,
    programName: t("wallet.pass.programName"),
    stampsLabel: t("wallet.pass.stamps"),
    stamps: `7/${cafe.stamps_required}`,
  };

  return (
    <Shell t={t} wide>
      <AdminHeader t={t} active="wallet" title={t("admin.wallet.title")} />
      <p className="mt-3 max-w-[60ch] text-roast">{t("admin.wallet.intro")}</p>

      <section className="mt-6 grid gap-6 rounded-[1.5rem] border border-line bg-foam/60 p-5 md:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="grid justify-items-center gap-2 md:justify-items-start">
          <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-gold-ink uppercase">{t("admin.wallet.now")}</p>
          <WalletPreview
            color={current.backgroundColor}
            heroUrl={heroImageUrl(current.heroImage, "")}
            heroAlt={t("admin.wallet.previewAlt", { name: current.name })}
            {...preview}
          />
          <p className="font-semibold">{current.id ? current.name : t("admin.wallet.everyday")}</p>
        </div>
        <div className="grid content-start gap-4">
          {([
            ["google", status.google, t("admin.wallet.statusOn"), t("admin.wallet.statusOff"), "admin.wallet.passes"],
            ["apple", status.apple, t("admin.wallet.appleOn"), t("admin.wallet.appleOff"), "admin.wallet.applePasses"],
          ] as const).map(([id, wallet, on, off, count]) => (
            <p
              key={id}
              role="status"
              className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${wallet.enabled ? "bg-olive-soft text-olive" : "bg-line/40 text-roast"}`}
            >
              {wallet.enabled ? on : off}
              {wallet.enabled && <> {t.plural(count, { count: wallet.passes })}.</>}
            </p>
          ))}
          <WalletSyncForm
            disabled={!status.google.enabled && !status.apple.enabled}
            labels={{
              syncNow: m.syncNow,
              synced: m.synced,
              syncedNotified: m.syncedNotified,
              syncedAppleMore: m.syncedAppleMore,
              errors: { syncFailed: m.syncFailed, syncOff: m.syncOff },
            }}
          />
        </div>
      </section>

      <h2 className="mt-10 font-display text-2xl font-medium">{t("admin.wallet.themes")}</h2>
      {themes.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">{t("admin.wallet.empty")}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {themes.map((theme) => {
            const onNow = theme.id === current.id;
            return (
              <li key={theme.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-foam/60 px-4 py-3">
                <span className="relative w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-line" style={{ backgroundColor: theme.background_color }}>
                  <img
                    src={heroImageUrl(theme.hero_image, "")}
                    alt={t("admin.wallet.previewAlt", { name: theme.name })}
                    width={1032}
                    height={336}
                    className="block aspect-[1032/336] w-full object-cover"
                  />
                  <span aria-hidden className="block h-2.5" />
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-semibold">{theme.name}</p>
                  <p className="text-xs text-muted">{range(theme)}</p>
                  {(theme.message_el || theme.message_en) && (
                    <p className="mt-0.5 truncate text-xs text-roast italic">{theme.message_el || theme.message_en}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    onNow ? "bg-olive-soft text-olive" : theme.active ? "bg-line/40 text-roast" : "bg-line/60 text-muted"
                  }`}
                >
                  {onNow ? t("admin.wallet.onNow") : theme.active ? t("admin.wallet.scheduled") : t("admin.wallet.off")}
                </span>
                {theme.notify && <span className="rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-semibold text-gold-ink">{t("admin.wallet.notifies")}</span>}
                <div className="flex gap-2">
                  <form action={setWalletThemeActive}>
                    <input type="hidden" name="id" value={theme.id} />
                    <input type="hidden" name="active" value={theme.active ? "false" : "true"} />
                    <button type="submit" className="min-h-11 rounded-full px-4 text-sm font-semibold text-roast ring-1 ring-line hover:text-espresso">
                      {theme.active ? t("admin.wallet.deactivate") : t("admin.wallet.activate")}
                    </button>
                  </form>
                  <form action={deleteWalletTheme}>
                    <input type="hidden" name="id" value={theme.id} />
                    <button type="submit" className="min-h-11 rounded-full px-4 text-sm font-semibold text-berry ring-1 ring-line hover:bg-berry-soft">
                      {t("admin.wallet.delete")}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-10 mb-4 font-display text-2xl font-medium">{t("admin.wallet.addTitle")}</h2>
      <ThemeForm presets={themePresets(today)} labels={m} preview={preview} />
    </Shell>
  );
}
