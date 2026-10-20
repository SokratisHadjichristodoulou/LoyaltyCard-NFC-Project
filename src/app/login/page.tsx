import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { getUser, safeNext } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { LoginForm } from "@/components/LoginForm";

type Props = { searchParams: Promise<{ next?: string; error?: string; signed_out?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getUser()) redirect(next);

  const t = await getT();
  const errors = t.messages.login.errors;
  const linkError = params.error === "link_invalid" ? errors.link_invalid : undefined;

  return (
    <Shell t={t}>
      <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight">{t("login.title")}</h1>
      <p className="mt-3 max-w-[34ch] text-roast">{t("login.intro")}</p>

      {params.signed_out && (
        <p role="status" className="mt-6 rounded-xl bg-olive-soft px-4 py-3 text-sm text-olive">
          {t("login.signedOut")}
        </p>
      )}

      <div className="mt-8">
        <LoginForm
          next={next}
          initialError={linkError}
          labels={{
            email: t("login.emailLabel"),
            placeholder: t("login.emailPlaceholder"),
            submit: t("login.submit"),
            errors,
          }}
        />
      </div>
      <p className="mt-5 text-sm text-muted">{t("login.privacy")}</p>
    </Shell>
  );
}
