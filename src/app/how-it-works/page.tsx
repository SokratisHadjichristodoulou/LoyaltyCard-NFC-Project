import { getT } from "@/i18n/server";
import { Shell } from "@/components/Shell";
import { CupGlyph } from "@/components/Stamp";

type Props = { searchParams: Promise<{ state?: string }> };

function TapGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="11" y="5" width="16" height="30" rx="3.5" />
      <path d="M17 30h4" />
      <path d="M31 15a6 6 0 0 1 0 10M34.5 12a10.5 10.5 0 0 1 0 16" />
    </svg>
  );
}

function GiftCupGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14h20l-2 19a3 3 0 0 1-3 2.6h-10a3 3 0 0 1-3-2.6L9 14Z" />
      <path d="M7 10h24v4H7z" />
      <path d="M19 6.5 20.2 9l2.8.4-2 2 .5 2.7L19 12.8l-2.5 1.3.5-2.7-2-2 2.8-.4L19 6.5Z" transform="translate(0 -3) scale(1)" />
      <path d="M15 22c2 2 6 2 8 0" />
    </svg>
  );
}

const icons = [CupGlyph, TapGlyph, GiftCupGlyph];

export default async function HowItWorksPage({ searchParams }: Props) {
  const { state } = await searchParams;
  const t = await getT();
  const steps = t.messages.how.steps;

  return (
    <Shell t={t} active="how" state={state}>
      <h1 className="font-display text-[2.4rem] leading-none font-medium tracking-tight">{t("how.title")}</h1>
      <p className="mt-3 text-roast">{t("how.intro")}</p>

      <ol className="mt-8 space-y-4">
        {steps.map((step, i) => {
          const Icon = icons[i];
          return (
            <li
              key={step.title}
              className="rise-in relative grid grid-cols-[auto_1fr] gap-x-5 rounded-[1.5rem] border border-line bg-crema/70 p-5"
              style={{ ["--delay" as string]: `${i * 120}ms` }}
            >
              <span className="flex size-14 items-center justify-center rounded-full bg-espresso text-crema">
                <Icon className="size-8" />
              </span>
              <div>
                <p className="font-display text-sm text-caramel-ink italic tabular">0{i + 1}</p>
                <h2 className="font-display text-xl leading-tight font-medium">{step.title}</h2>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-roast">{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Shell>
  );
}
