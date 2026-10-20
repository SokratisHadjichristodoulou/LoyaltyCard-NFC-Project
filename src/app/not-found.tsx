import { getT } from "@/i18n/server";
import { Shell } from "@/components/Shell";
import { ErrorView } from "@/components/ErrorView";

export default async function NotFound() {
  const t = await getT();
  return (
    <Shell t={t}>
      <ErrorView
        code={t("errors.notFound.code")}
        title={t("errors.notFound.title")}
        body={t("errors.notFound.body")}
        backLabel={t("errors.back")}
      />
    </Shell>
  );
}
