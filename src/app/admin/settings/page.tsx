import { getT } from "@/i18n/server";
import { loadCafeSettings } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { AdminHeader } from "@/components/admin/AdminNav";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const cafe = await loadCafeSettings();
  const t = await getT();
  const m = t.messages.admin.settings;

  return (
    <Shell t={t} wide>
      <AdminHeader t={t} active="settings" title={t("admin.settings.title")} />
      <p className="mt-3 max-w-[60ch] text-roast">
        {cafe.name}. {t("admin.settings.intro")}
      </p>
      <div className="mt-6">
        <SettingsForm
          values={{
            stamps_required: cafe.stamps_required,
            coupon_valid_days: cafe.coupon_valid_days,
            cooldown_minutes: cafe.stamp_cooldown_seconds / 60,
          }}
          labels={{
            stampsRequired: m.stampsRequired,
            couponDays: m.couponDays,
            cooldown: m.cooldown,
            cooldownHelp: m.cooldownHelp,
            save: m.save,
            saved: m.saved,
            errors: m.errors,
          }}
        />
      </div>
    </Shell>
  );
}
