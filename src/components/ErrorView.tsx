import Link from "next/link";

/**
 * Shared look for the 404 and error pages: a tipped-over cup, a short
 * message and a way back. No data fetching, so it renders even when the
 * database or the session is the problem.
 */
export function ErrorView({
  code,
  title,
  body,
  backLabel,
  children,
}: {
  code?: string;
  title: string;
  body: string;
  backLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-line bg-crema/70 px-6 py-10 text-center">
      <svg aria-hidden viewBox="0 0 120 80" className="mx-auto h-20 w-28" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* a cup lying on its side, a little coffee spilling from the rim */}
        <path d="M62 62 c8 1 14 5 26 4 c10 -1 14 -4 22 -3" className="stroke-gold" />
        <circle cx="96" cy="56" r="2.5" className="fill-gold" />
        <path d="M60 22 L24 27 C14 30 14 50 24 53 L60 58" className="stroke-roast" />
        <ellipse cx="60" cy="40" rx="6" ry="18" className="stroke-roast" />
        <path d="M33 26 c-1 -11 13 -13 15 -3" className="stroke-roast" />
      </svg>
      {code && <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.28em] text-gold-ink uppercase">{code}</p>}
      <h1 className="mt-2 font-display text-3xl font-medium text-espresso">{title}</h1>
      <p className="mx-auto mt-2 max-w-[32ch] leading-relaxed text-roast">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {children}
        <Link href="/" className="inline-flex min-h-12 items-center rounded-full border border-espresso px-6 font-semibold text-espresso">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
