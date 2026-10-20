import Link from "next/link";
import type { Translator } from "@/i18n/translate";
import { checkSchema } from "@/lib/schema-check";

export type AdminSection = "overview" | "customers" | "tags" | "settings";

const sections: { id: AdminSection; href: string }[] = [
  { id: "overview", href: "/admin" },
  { id: "customers", href: "/admin/customers" },
  { id: "tags", href: "/admin/tags" },
  { id: "settings", href: "/admin/settings" },
];

export function AdminNav({ t, active }: { t: Translator; active: AdminSection }) {
  return (
    <nav aria-label={t("admin.nav.label")}>
      <ul className="flex flex-wrap gap-1.5">
        {sections.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
                  current ? "bg-espresso text-gold-light" : "bg-foam text-roast ring-1 ring-line hover:text-espresso"
                }`}
              >
                {t(`admin.nav.${s.id}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export async function AdminHeader({ t, active, title }: { t: Translator; active: AdminSection; title: string }) {
  const schema = await checkSchema().catch(() => null);
  return (
    <div className="grid gap-4">
      {schema && !schema.ok && (
        <div role="alert" className="rounded-2xl border-2 border-berry bg-berry-soft px-4 py-3 text-sm leading-relaxed text-berry">
          <p className="font-semibold">{t("admin.schema.title")}</p>
          <p className="mt-1">
            {schema.trackerMissing ? t("admin.schema.tracker") : t("admin.schema.missing", { list: schema.missing.join(", ") })}
          </p>
          <p className="mt-1">{t("admin.schema.fix")}</p>
          <code className="mt-1 inline-block rounded-md bg-paper px-2 py-0.5 font-mono text-xs text-espresso select-all">npx supabase db push</code>
        </div>
      )}
      <p className="text-[0.7rem] font-semibold tracking-[0.28em] text-gold-ink uppercase">{t("admin.title")}</p>
      <AdminNav t={t} active={active} />
      <h1 className="mt-2 font-display text-[2.2rem] leading-none font-medium tracking-tight">{title}</h1>
    </div>
  );
}
