import { getT } from "@/i18n/server";
import { intlLocale, type Locale } from "@/i18n/config";
import { loadTags } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { AdminHeader } from "@/components/admin/AdminNav";
import { TagForm } from "@/components/admin/TagForm";
import { setTagActive } from "../actions";

export default async function AdminTagsPage() {
  const tags = await loadTags();
  const t = await getT();
  const date = new Intl.DateTimeFormat(intlLocale[t.locale as Locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Nicosia",
  });
  const m = t.messages.admin.tags;

  return (
    <Shell t={t} wide>
      <AdminHeader t={t} active="tags" title={t("admin.tags.title")} />
      <p className="mt-3 max-w-[60ch] text-roast">{t("admin.tags.intro")}</p>

      <div className="mt-6">
        <TagForm
          labels={{
            label: m.label,
            labelPlaceholder: m.labelPlaceholder,
            uid: m.uid,
            uidPlaceholder: m.uidPlaceholder,
            uidHelp: m.uidHelp,
            add: m.add,
            saved: m.saved,
            errors: m.errors,
          }}
        />
      </div>

      {tags.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">{t("admin.tags.empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {tags.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-foam/60 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{tag.label}</p>
                <p className="text-xs text-muted">
                  <span className="font-mono">{tag.tag_uid}</span>
                  <span className="whitespace-nowrap"> · {t("admin.tags.added", { date: date.format(new Date(tag.created_at)) })}</span>
                  <span className="whitespace-nowrap">
                    {" · "}
                    {tag.last_tap_at
                      ? t("admin.tags.lastTap", { date: date.format(new Date(tag.last_tap_at)) })
                      : t("admin.tags.neverTapped")}
                  </span>
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tag.active ? "bg-olive-soft text-olive" : "bg-line/60 text-roast"}`}
              >
                {tag.active ? t("admin.tags.active") : t("admin.tags.inactive")}
              </span>
              <form action={setTagActive}>
                <input type="hidden" name="id" value={tag.id} />
                <input type="hidden" name="active" value={tag.active ? "false" : "true"} />
                <button type="submit" className="min-h-11 rounded-full px-4 text-sm font-semibold text-roast ring-1 ring-line hover:text-espresso">
                  {tag.active ? t("admin.tags.deactivate") : t("admin.tags.activate")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
