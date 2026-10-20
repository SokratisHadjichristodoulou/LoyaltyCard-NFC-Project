import { getT } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { Shell } from "@/components/Shell";

// Placeholder: protected by src/proxy.ts and checked again here.
export default async function AdminPage() {
  await requireRole("admin");
  const t = await getT();
  return (
    <Shell t={t}>
      <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight">{t("admin.title")}</h1>
      <p className="mt-3 text-roast">{t("admin.placeholder")}</p>
    </Shell>
  );
}
