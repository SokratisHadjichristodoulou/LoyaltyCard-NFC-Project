import Link from "next/link";
import type { Translator } from "@/i18n/translate";
import { ACTIVE_SCENARIO, scenarioNames } from "@/lib/mock-data";
import { withState } from "./href";

const paths = { card: "/", coupon: "/coupon", how: "/how-it-works" } as const;

/** Step-1 helper for previewing mock states. Remove once real data is wired. */
export function PreviewBar({
  t,
  active,
  state,
}: {
  t: Translator;
  active: keyof typeof paths;
  state?: string;
}) {
  const current = state ?? ACTIVE_SCENARIO;
  return (
    <aside aria-label={t("preview.label")} className="mb-6 rounded-2xl border border-dashed border-line px-3 py-2.5">
      <p className="mb-1.5 text-[0.7rem] font-semibold tracking-[0.2em] text-muted uppercase">
        {t("preview.label")} · mock
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {scenarioNames.map((name) => (
          <li key={name}>
            <Link
              href={withState(paths[active], name)}
              aria-current={name === current ? "true" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-3 font-mono text-xs ${
                name === current ? "bg-espresso text-paper" : "bg-foam text-roast hover:text-espresso"
              }`}
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
