import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { getProfile, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { NameForm } from "@/components/account/NameForm";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";

export default async function AccountPage() {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);
  if (!user || !profile) redirect(`/login?next=${encodeURIComponent("/account")}`);
  const t = await getT();
  const m = t.messages.account;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();

  const card = "grid gap-3 rounded-[1.5rem] border border-line bg-crema/70 p-5";
  const heading = "font-display text-xl font-medium";

  return (
    <Shell t={t}>
      <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight">{m.title}</h1>
      <p className="mt-3 text-sm break-all text-muted">{t("account.signedInAs", { email: user.email ?? "" })}</p>

      <div className="mt-7 grid grid-cols-1 gap-5">
        <section aria-labelledby="name-title" className={card}>
          <h2 id="name-title" className={heading}>{m.name.title}</h2>
          <p className="text-sm text-roast">{m.name.help}</p>
          <NameForm
            current={data?.display_name ?? ""}
            labels={{ label: m.name.label, save: m.name.save, saved: m.name.saved, errors: { tooLong: m.name.tooLong, failed: m.delete.failed } }}
          />
        </section>

        <section aria-labelledby="data-title" className={card}>
          <h2 id="data-title" className={heading}>{m.data.title}</h2>
          <p className="text-sm text-roast">{m.data.body}</p>
          <a href="/api/account/export" className="inline-flex min-h-12 w-fit items-center rounded-full border border-espresso px-6 font-semibold">
            {m.data.download}
          </a>
        </section>

        <section aria-labelledby="delete-title" className="grid gap-3 rounded-[1.5rem] border border-berry/40 bg-berry-soft/40 p-5">
          <h2 id="delete-title" className={`${heading} text-berry`}>{m.delete.title}</h2>
          {profile.role === "customer" ? (
            <>
              <p className="text-sm text-roast">{m.delete.body}</p>
              <DeleteAccountForm
                labels={{
                  confirm: m.delete.confirm,
                  button: m.delete.button,
                  errors: { mustConfirm: m.delete.mustConfirm, failed: m.delete.failed, staff: m.delete.staff },
                }}
              />
            </>
          ) : (
            <p className="text-sm text-roast">{m.delete.staff}</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
