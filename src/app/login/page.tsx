import Link from "next/link";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { getUser, safeNext } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { LoginForm } from "@/components/LoginForm";
import { TAP_COMPLETE_PATH } from "@/lib/nfc/paths";

type Props = { searchParams: Promise<{ next?: string; error?: string; signed_out?: string; deleted?: string }> };

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
      {next === TAP_COMPLETE_PATH && (
        <p role="status" className="mt-4 rounded-xl bg-gold/20 px-4 py-3 text-sm leading-relaxed text-espresso ring-1 ring-gold/40">
          {t("tap.signInToCollect")}
        </p>
      )}
      <p className="mt-3 max-w-[34ch] text-roast">{t("login.intro")}</p>

      {params.deleted && (
        <p role="status" className="mt-6 rounded-xl bg-olive-soft px-4 py-3 text-sm text-olive">
          {t("account.deleted")}
        </p>
      )}

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
      <p className="mt-5 text-sm text-muted">
        {t("login.privacy")}{" "}
        <Link href="/privacy" className="font-semibold text-gold-ink underline underline-offset-4">
          {t("footer.privacy")}
        </Link>
      </p>
    </Shell>
  );
}
